
    // ══════════════════════════════
    // LISTINGS DATA
    // ══════════════════════════════
    const listings = [
      {
        id: 1,
        title: "Professional Camera Equipment",
        desc: "Portrait and event photography. Looking to exchange for web design or graphic design services.",
        user: "Sarah Johnson", userInitials: "SJ", userColor: "#2563EB",
        category: "Services",
        value: "$200-300",
        verified: true,
        img: "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=600&q=80"
      },
      {
        id: 2,
        title: "Vintage Acoustic Guitar",
        desc: "Well-maintained vintage guitar. Looking for laptop or tablet.",
        user: "Mike Chen", userInitials: "MC", userColor: "#7C3AED",
        category: "Art & Craft",
        value: "$400-500",
        verified: true,
        img: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80"
      },
      {
        id: 3,
        title: "Web Development Services",
        desc: "Full-stack web development. Can build responsive websites and web apps.",
        user: "Alex Rivera", userInitials: "AR", userColor: "#EA580C",
        category: "Services",
        value: "$500-1000",
        verified: true,
        img: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&q=80"
      },
      {
        id: 4,
        title: "Designer Furniture Set",
        desc: "Modern minimalist furniture including desk and chair. Looking for electronics.",
        user: "Emma Wilson", userInitials: "EW", userColor: "#16a34a",
        category: "Furniture",
        value: "$300-400",
        verified: false,
        img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80"
      },
      {
        id: 5,
        title: "Mountain Bike — Trek",
        desc: "Lightly used Trek mountain bike in excellent condition. Looking for gaming gear.",
        user: "James Park", userInitials: "JP", userColor: "#DB2777",
        category: "Sports",
        value: "$350-450",
        verified: true,
        img: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=600&q=80"
      },
      {
        id: 6,
        title: "Programming Books Collection",
        desc: "10+ programming books including Python, JS, React. Looking for art supplies.",
        user: "Lisa Wang", userInitials: "LW", userColor: "#CA8A04",
        category: "Books",
        value: "$80-120",
        verified: true,
        img: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80"
      },
      {
        id: 7,
        title: "Sony PlayStation 5",
        desc: "PS5 console with 2 controllers and 5 games. Looking for laptop or MacBook.",
        user: "Ryan Scott", userInitials: "RS", userColor: "#0891B2",
        category: "Electronics",
        value: "$450-550",
        verified: true,
        img: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600&q=80"
      },
      {
        id: 8,
        title: "Handmade Pottery Set",
        desc: "Beautiful handmade ceramic pottery. Great for kitchen or decoration.",
        user: "Aria Kim", userInitials: "AK", userColor: "#9333ea",
        category: "Art & Craft",
        value: "$100-150",
        verified: false,
        img: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=80"
      },
      {
        id: 9,
        title: "Drone DJI Mini 3",
        desc: "DJI Mini 3 drone with extra batteries. Looking for mirrorless camera.",
        user: "Tom Baker", userInitials: "TB", userColor: "#2563EB",
        category: "Electronics",
        value: "$600-750",
        verified: true,
        img: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&q=80"
      },
      {
        id: 10,
        title: "Yoga & Fitness Package",
        desc: "Yoga mat, resistance bands, and weights. Looking for cooking classes.",
        user: "Nina Patel", userInitials: "NP", userColor: "#DB2777",
        category: "Sports",
        value: "$120-180",
        verified: true,
        img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80"
      },
      {
        id: 11,
        title: "Vintage Book Collection",
        desc: "Classic literature collection — 20+ hardcover books in great condition.",
        user: "Chris Lee", userInitials: "CL", userColor: "#CA8A04",
        category: "Books",
        value: "$60-100",
        verified: false,
        img: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80"
      },
      {
        id: 12,
        title: "Standing Desk + Chair",
        desc: "Ergonomic standing desk with adjustable height and premium office chair.",
        user: "Mia Torres", userInitials: "MT", userColor: "#16a34a",
        category: "Furniture",
        value: "$400-600",
        verified: true,
        img: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80"
      },
      {
        id: 13,
        title: "Graphic Design Services",
        desc: "Logo design, branding, and social media graphics. Trade for coding help.",
        user: "Oscar Diaz", userInitials: "OD", userColor: "#7C3AED",
        category: "Services",
        value: "$200-400",
        verified: true,
        img: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&q=80"
      },
      {
        id: 14,
        title: "iPad Pro 12.9\"",
        desc: "iPad Pro with Apple Pencil and keyboard case. Looking for audio equipment.",
        user: "Sophie Green", userInitials: "SG", userColor: "#0891B2",
        category: "Electronics",
        value: "$700-900",
        verified: true,
        img: "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600&q=80"
      },
      {
        id: 15,
        title: "Oil Painting — Abstract",
        desc: "Original 60x80cm oil painting on canvas. Looking for photography services.",
        user: "Lena Fox", userInitials: "LF", userColor: "#EA580C",
        category: "Art & Craft",
        value: "$250-350",
        verified: false,
        img: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&q=80"
      },
      {
        id: 16,
        title: "Tennis Racket Set",
        desc: "2 Wilson tennis rackets with balls and bag. Looking for cycling gear.",
        user: "Kai Yamamoto", userInitials: "KY", userColor: "#16a34a",
        category: "Sports",
        value: "$150-200",
        verified: true,
        img: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&q=80"
      },
      {
        id: 17,
        title: "Self-Help Book Bundle",
        desc: "15 bestselling self-help and business books. Great condition.",
        user: "Fiona Bell", userInitials: "FB", userColor: "#CA8A04",
        category: "Books",
        value: "$70-100",
        verified: true,
        img: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80"
      },
      {
        id: 18,
        title: "Sofa — 3 Seater",
        desc: "Comfortable 3-seater sofa in light grey. Looking for home appliances.",
        user: "Ben Carter", userInitials: "BC", userColor: "#2563EB",
        category: "Furniture",
        value: "$300-500",
        verified: false,
        img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80"
      }
    ];

    // ══════════════════════════════
    // STATE
    // ══════════════════════════════
    let currentCategory = 'All';
    let currentSearch   = '';
    let currentItem     = null;
    let favoriteListingIds = [];

    // ══════════════════════════════
    // RENDER CARDS
    // ══════════════════════════════
    function renderListings() {
      const grid = document.getElementById('listingsGrid');
      const noResults = document.getElementById('noResults');
      const itemsFound = document.getElementById('itemsFound');

      const filtered = listings.filter(item => {
        const matchCat = currentCategory === 'All' || item.category === currentCategory;
        const matchSearch = item.title.toLowerCase().includes(currentSearch.toLowerCase()) ||
                            item.desc.toLowerCase().includes(currentSearch.toLowerCase()) ||
                            item.category.toLowerCase().includes(currentSearch.toLowerCase());
        return matchCat && matchSearch;
      });

      itemsFound.textContent = filtered.length + ' items found';

      if (filtered.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        return;
      }

      noResults.style.display = 'none';
      grid.innerHTML = filtered.map(item => {
        const isFavorited = favoriteListingIds.includes(item.id);
        const posted = item.posted || '2 hours ago';
        const location = item.location || 'New York, NY';
        return `
        <div class="col-12 col-sm-6 col-lg-3">
          <div class="product-card">
            <div class="card-img-wrap">
              <img src="${item.img}" alt="${item.title}" loading="lazy"
                onerror="this.src='https://via.placeholder.com/400x200?text=Image'"/>
              <button class="card-favorite-btn ${isFavorited ? 'favorited' : ''}" onclick="toggleListingFavorite(${item.id}); event.stopPropagation();">
                <i class="bi ${isFavorited ? 'bi-heart-fill' : 'bi-heart'}"></i>
              </button>
              ${item.verified ? `<span class="verified-badge"><i class="bi bi-patch-check-fill"></i> Verified</span>` : ''}
            </div>
            <div class="card-body-custom">
              <div class="card-product-title">${item.title}</div>
              <div class="card-product-desc">${item.desc}</div>
              <div class="card-user">
                <div class="user-avatar" style="background:${item.userColor};">${item.userInitials}</div>
                <span class="user-name">${item.user}</span>
              </div>
              <div class="card-meta">
                <span><i class="bi bi-calendar-event"></i> ${posted}</span>
                <span><i class="bi bi-geo-alt"></i> ${location}</span>
              </div>
              <span class="card-tag">${item.category}</span>
              <div class="card-value">Est. Value: <span>${item.value}</span></div>
              <a href="#" class="btn-view-details" onclick="openModal(${item.id}); return false;">View Details</a>
            </div>
          </div>
        </div>
      `;
      }).join('');
    }

    // ══════════════════════════════
    // FILTER BY CATEGORY
    // ══════════════════════════════
    function setCategory(cat, btn) {
      currentCategory = cat;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderListings();
    }

    // ══════════════════════════════
    // FILTER BY SEARCH
    // ══════════════════════════════
    function filterListings() {
      currentSearch = document.getElementById('searchInput').value;
      renderListings();
    }

    // ══════════════════════════════
    // OPEN MODAL
    // ══════════════════════════════
    function openModal(id) {
      const item = listings.find(l => l.id === id);
      if (!item) return;
      currentItem = item;
      document.getElementById('modalTitle').textContent = item.title;
      document.getElementById('modalImg').src = item.img;
      document.getElementById('modalImg').alt = item.title;
      document.getElementById('modalProductTitle').textContent = item.title;
      document.getElementById('modalDesc').textContent = item.desc;
      document.getElementById('modalCategory').textContent = item.category;
      document.getElementById('modalValue').textContent = item.value;
      document.getElementById('modalUser').textContent = item.user;
      document.getElementById('modalDate').textContent = item.posted || 'Dec 15, 2023 at 2:30 PM';
      document.getElementById('modalLocation').textContent = item.location || 'New York, NY';
      document.getElementById('modalDate').textContent = item.posted || 'Dec 15, 2023 at 2:30 PM';
      updateModalFavoriteButton();
      new bootstrap.Modal(document.getElementById('detailModal')).show();
    }

    function updateModalFavoriteButton() {
      const btn = document.getElementById('modalFavBtn');
      if (!btn || !currentItem) return;
      const isFavorited = favoriteListingIds.includes(currentItem.id);
      btn.classList.toggle('favorited', isFavorited);
      btn.innerHTML = `<i class="bi ${isFavorited ? 'bi-heart-fill' : 'bi-heart'}"></i> ${isFavorited ? 'Favorited' : 'Add to Favorites'}`;
      const favDetailBtn = document.getElementById('favoriteBtn');
      if (favDetailBtn) {
        favDetailBtn.classList.toggle('favorited', isFavorited);
        favDetailBtn.innerHTML = `<i class="bi ${isFavorited ? 'bi-heart-fill' : 'bi-heart'}"></i> ${isFavorited ? 'Favorited' : 'Add to Favorites'}`;
      }
    }

    // ══════════════════════════════
    // HANDLE TRADE CLICK
    // ══════════════════════════════
    function handleTrade() {
      bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
      showToast('Please sign up to make an offer! 🚀');
      setTimeout(() => { window.location.href = 'signup.html'; }, 1800);
    }

    // ══════════════════════════════
    // TOGGLE FAVORITE
    // ══════════════════════════════
    function toggleFavorite(event) {
      if (event) event.stopPropagation();
      if (!currentItem) return;
      toggleListingFavorite(currentItem.id);
      updateModalFavoriteButton();
    }

    function toggleListingFavorite(id) {
      const index = favoriteListingIds.indexOf(id);
      if (index === -1) {
        favoriteListingIds.push(id);
        showToast('Added listing to favorites ❤️');
      } else {
        favoriteListingIds.splice(index, 1);
        showToast('Removed listing from favorites');
      }
      renderListings();
    }

    // ══════════════════════════════
    // MESSAGE SELLER
    // ══════════════════════════════
    function messageSeller() {
      bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
      showToast('Please sign up to message the seller! 💬');
      setTimeout(() => { window.location.href = 'signup.html'; }, 1800);
    }

    // ══════════════════════════════
    // TOAST
    // ══════════════════════════════
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    // Init
    renderListings();

