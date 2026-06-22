 // Scroll animation for step rows
    const stepRows = document.querySelectorAll('.step-row');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.15 });

    stepRows.forEach(row => {
      row.style.opacity = '0';
      row.style.transform = 'translateY(28px)';
      row.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      obs.observe(row);
    });
