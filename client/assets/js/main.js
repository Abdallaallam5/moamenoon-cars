/**
 * main.js
 * -----------------------------------------------------------------------
 * Global behaviors shared across most pages: navbar toggle, AOS/Swiper
 * init, animated stat counters, home page data loading (categories,
 * brands, featured/latest listings), the shared vehicle-card renderer,
 * favorite toggling, and the newsletter/contact forms.
 * -----------------------------------------------------------------------
 */

// ============================================================
// SHARED: Vehicle card renderer (used on home, listing, favorites pages)
// ============================================================
function formatPrice(price, currency) {
  return `${currency || 'USD'} ${Number(price).toLocaleString()}`;
}

function renderVehicleCard(vehicle) {
  const image = vehicle.primaryImage || (vehicle.images && vehicle.images[0] && vehicle.images[0].url) || 'https://via.placeholder.com/600x400?text=No+Image';
  const brandName = vehicle.brand && vehicle.brand.name ? vehicle.brand.name : '';
  const isFav = window.__favoriteIds && window.__favoriteIds.has(vehicle._id);

  return `
    <div class="vehicle-card" data-id="${vehicle._id}">
      <a href="vehicle-details.html?id=${vehicle._id}" class="vehicle-card__media">
        <img src="${image}" alt="${vehicle.title}" loading="lazy" />
        <span class="vehicle-card__badge">${vehicle.condition || ''}</span>
      </a>
      <button class="vehicle-card__fav ${isFav ? 'is-active' : ''}" data-fav-id="${vehicle._id}" aria-label="Toggle favorite">
        <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
      </button>
      <div class="vehicle-card__body">
        <div class="vehicle-card__price">${formatPrice(vehicle.price, vehicle.currency)}</div>
        <a href="vehicle-details.html?id=${vehicle._id}"><h3 class="vehicle-card__title">${vehicle.title}</h3></a>
        <div class="vehicle-card__meta">
          <span><i class="fa-solid fa-calendar"></i> ${vehicle.year}</span>
          <span><i class="fa-solid fa-road"></i> ${Number(vehicle.mileage).toLocaleString()} km</span>
          <span><i class="fa-solid fa-gas-pump"></i> ${vehicle.fuel}</span>
        </div>
        <div class="vehicle-card__footer">
          <span>${brandName}</span>
          <span><i class="fa-solid fa-location-dot"></i> ${vehicle.location ? vehicle.location.city : ''}</span>
        </div>
      </div>
    </div>`;
}

// ============================================================
// FAVORITES TOGGLE (event delegation, works on any page with vehicle cards)
// ============================================================
async function loadFavoriteIds() {
  window.__favoriteIds = new Set();
  if (!window.api || !api.isLoggedIn()) return;
  try {
    const res = await api.get('/favorites');
    res.data.forEach((f) => window.__favoriteIds.add(f.vehicle._id || f.vehicle));
  } catch (e) {
    // silently ignore — favorites are a non-critical enhancement
  }
}

function initFavoriteToggling() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fav-id]');
    if (!btn) return;
    e.preventDefault();

    if (!api.isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }

    const vehicleId = btn.dataset.favId;
    const isActive = btn.classList.contains('is-active');
    btn.disabled = true;

    try {
      if (isActive) {
        await api.delete(`/favorites/${vehicleId}`);
        btn.classList.remove('is-active');
        btn.querySelector('i').className = 'fa-regular fa-heart';
        window.__favoriteIds.delete(vehicleId);
      } else {
        await api.post(`/favorites/${vehicleId}`);
        btn.classList.add('is-active');
        btn.querySelector('i').className = 'fa-solid fa-heart';
        window.__favoriteIds.add(vehicleId);
      }
    } catch (err) {
      console.error(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

// ============================================================
// NAVBAR: mobile burger toggle
// ============================================================
function initNavbarBurger() {
  const burger = document.getElementById('navbarBurger');
  const nav = document.getElementById('navbarNav');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    burger.classList.toggle('is-open');
    nav.classList.toggle('is-open');
  });
}

// ============================================================
// FOOTER: current year
// ============================================================
function setFooterYear() {
  const el = document.getElementById('footerYear');
  if (el) el.textContent = new Date().getFullYear();
}

// ============================================================
// STAT COUNTERS: animate numbers when scrolled into view
// ============================================================
function initStatCounters() {
  const counters = document.querySelectorAll('.stat-card__number[data-count]');
  if (counters.length === 0) return;

  const animate = (el) => {
    const target = Number(el.dataset.count);
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));
}

// ============================================================
// HOME PAGE: load categories, brands, featured & latest listings
// ============================================================
async function loadHomeCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  try {
    const res = await api.get('/categories?featured=true');
    if (res.data.length === 0) return; // keep the static fallback markup already in the HTML
    grid.innerHTML = res.data
      .map(
        (cat, i) => `
      <a href="${cat.type}s.html?category=${cat.slug}" class="category-card" data-aos="fade-up" data-aos-delay="${i * 50}">
        <img src="${cat.image || 'https://via.placeholder.com/400x300'}" alt="${cat.name.en}" />
        <div class="category-card__label"><i class="fa-solid ${cat.icon || 'fa-car'}"></i><span>${cat.name.en}</span></div>
      </a>`
      )
      .join('');
    // These cards are injected after AOS.init() already scanned the DOM,
    // so ask AOS to pick up the new [data-aos] elements.
    if (window.AOS) AOS.refresh();
  } catch (e) {
    // keep static fallback on failure
  }
}

async function loadHomeBrands() {
  const grid = document.getElementById('brandsGrid');
  if (!grid) return;
  try {
    const res = await api.get('/brands?popular=true');
    grid.innerHTML = res.data
      .map((b) => `<div class="brand-tile" title="${b.name}"><img src="${b.logo || 'https://via.placeholder.com/120x60?text=' + b.name}" alt="${b.name}" /></div>`)
      .join('');

    // Also populate every <select id="searchBrand|filterBrand|vBrand"> on the page
    document.querySelectorAll('#searchBrand, #filterBrand, #vBrand').forEach((select) => {
      res.data.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b._id;
        opt.textContent = b.name;
        select.appendChild(opt);
      });
    });
  } catch (e) {
    grid.innerHTML = `<p class="text-muted">Unable to load brands right now.</p>`;
  }
}

async function loadFeaturedListings() {
  const wrapper = document.getElementById('featuredListingsWrapper');
  if (!wrapper) return;
  try {
    const res = await api.get('/vehicles?status=approved&limit=8&sort=-createdAt');
    const featured = res.data.filter((v) => v.isFeatured).length ? res.data.filter((v) => v.isFeatured) : res.data;
    wrapper.innerHTML = featured.map((v) => `<div class="swiper-slide">${renderVehicleCard(v)}</div>`).join('');

    if (window.Swiper) {
      new Swiper('.featured-swiper', {
        slidesPerView: 1.15,
        spaceBetween: 20,
        navigation: { nextEl: '.featured-swiper .swiper-button-next', prevEl: '.featured-swiper .swiper-button-prev' },
        breakpoints: { 640: { slidesPerView: 2 }, 992: { slidesPerView: 3 }, 1200: { slidesPerView: 4 } },
      });
    }
  } catch (e) {
    wrapper.innerHTML = `<p class="text-muted">Unable to load featured listings.</p>`;
  }
}

async function loadLatestListings() {
  const grid = document.getElementById('latestListingsGrid');
  if (!grid) return;
  try {
    const res = await api.get('/vehicles?status=approved&limit=6&sort=-createdAt');
    grid.innerHTML = res.data.map(renderVehicleCard).join('');
  } catch (e) {
    grid.innerHTML = `<p class="text-muted">Unable to load latest listings.</p>`;
  }
}

// ============================================================
// TESTIMONIALS SWIPER (home page)
// ============================================================
function initTestimonialsSwiper() {
  if (!document.querySelector('.testimonials-swiper') || !window.Swiper) return;
  new Swiper('.testimonials-swiper', {
    slidesPerView: 1,
    spaceBetween: 24,
    pagination: { el: '.testimonials-swiper .swiper-pagination', clickable: true },
    breakpoints: { 768: { slidesPerView: 2 }, 1100: { slidesPerView: 3 } },
  });
}

// ============================================================
// NEWSLETTER + CONTACT FORMS (demo submit handlers)
// ============================================================
function initNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.reset();
    alert('Thanks for subscribing!');
  });
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const successBox = document.getElementById('contactSuccess');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // In production this would POST to a /api/contact endpoint.
    successBox.style.display = 'block';
    form.reset();
    setTimeout(() => (successBox.style.display = 'none'), 4000);
  });
}

// ============================================================
// SEARCH TABS (hero search box on home page)
// ============================================================
function initSearchTabs() {
  const tabs = document.querySelectorAll('.search-tab');
  if (tabs.length === 0) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
    });
  });
}

function initAdvancedSearchToggle() {
  const toggle = document.getElementById('advancedToggle');
  const panel = document.getElementById('advancedSearch');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('is-open');
    panel.classList.toggle('is-open');
  });
}

function initQuickSearchForm() {
  const form = document.getElementById('quickSearchForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeTab = document.querySelector('.search-tab.is-active');
    const type = activeTab ? activeTab.dataset.type : 'car';
    const targetPage = { car: 'cars.html', motorcycle: 'motorcycles.html', truck: 'trucks.html' }[type];

    const params = new URLSearchParams();
    const keyword = document.getElementById('searchKeyword').value.trim();
    const brand = document.getElementById('searchBrand').value;
    const priceTo = document.getElementById('searchPriceTo').value;
    if (keyword) params.set('keyword', keyword);
    if (brand) params.set('brand', brand);
    if (priceTo) params.set('priceMax', priceTo);

    window.location.href = `${targetPage}?${params.toString()}`;
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  setFooterYear();
  initNavbarBurger();
  initSearchTabs();
  initAdvancedSearchToggle();
  initQuickSearchForm();
  initNewsletterForm();
  initContactForm();
  initFavoriteToggling();

  if (window.AOS) {
    AOS.init({ duration: 700, once: true, offset: 60 });
  } else {
    // AOS script failed to load (e.g. CDN unreachable) — reveal [data-aos]
    // content instead of leaving it stuck at opacity: 0 forever.
    document.documentElement.classList.add('aos-disabled');
  }

  await loadFavoriteIds();

  // Home-page-only data loaders (functions no-op if their target element is absent)
  loadHomeCategories();
  loadHomeBrands();
  loadFeaturedListings().then(initStatCounters);
  loadLatestListings();
  initTestimonialsSwiper();
  initStatCounters();
});
