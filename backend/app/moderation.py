"""Text-only inference using the two trusted, bundled training artifacts."""
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from decimal import Decimal
import json
import logging

from app import models

MODEL_DIR = Path(__file__).resolve().parents[1] / "ml_models"
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def load_classifier():
    import joblib

    model_path = MODEL_DIR / "moderation_model.pkl"
    vectorizer_path = MODEL_DIR / "tfidf_vectorizer.pkl"
    # Only these repository-controlled artifacts may be deserialized, never uploads.
    classifier = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
    if list(classifier.classes_) != [0, 1]:
        raise ValueError("Unexpected moderation labels; expected 0=issue, 1=clean")
    version = sha256(model_path.read_bytes() + vectorizer_path.read_bytes()).hexdigest()
    return classifier, vectorizer, version


def classify_text(text):
    classifier, vectorizer, version = load_classifier()
    features = vectorizer.transform([text])
    prediction = int(classifier.predict(features)[0])
    probabilities = classifier.predict_proba(features)[0]
    index = list(classifier.classes_).index(prediction)
    return {
        "label": "clean" if prediction == 1 else "issue",
        "confidence": float(probabilities[index]),
        "model_version": version,
    }


def post_revision(post, db):
    """Include all reviewable fields, including images, to reject stale decisions."""
    images = db.query(models.ProductImage).filter(
        models.ProductImage.product_id == post.p_id,
        models.ProductImage.status == 1,
    ).order_by(models.ProductImage.i_id).all()
    data = {
        "title": post.title, "description": post.description,
        "trade": post.in_exchange_for, "category": post.category_id,
        "condition": post.condition_score,
        "price_from": str(Decimal(str(post.price_from)).normalize()),
        "price_to": str(Decimal(str(post.price_to)).normalize()),
        "images": [image.image_url for image in images],
    }
    return sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def moderate_post(post, db):
    revision = post_revision(post, db)
    review = db.get(models.PostModeration, post.p_id)
    try:
        _, _, version = load_classifier()
        if review and review.revision == revision and review.model_version == version and review.label in ("clean", "issue"):
            return review
        result = classify_text(" ".join(filter(None, [post.title, post.description, post.in_exchange_for])))
    except Exception:
        logger.exception("Moderation failed for post %s", post.p_id)
        # Failure must never publish a post or masquerade as a clean result.
        result = {"label": "unavailable", "confidence": None, "model_version": None}
    if review is None:
        review = models.PostModeration(post_id=post.p_id)
        db.add(review)
    review.revision = revision
    for key, value in result.items():
        setattr(review, key, value)
    return review
