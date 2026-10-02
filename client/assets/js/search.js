/**
 * search.js
 * -----------------------------------------------------------------------
 * Powers the listing pages (cars.html, motorcycles.html, trucks.html) and
 * the favorites page: reads filters from the sidebar + URL query string,
 * calls GET /api/vehicles, and renders the results grid + pagination.
 * -----------------------------------------------------------------------
 */

(function () {
  const state = { page: 1 };

  function getVehicleType() {
    return document.body.dataset.vehicleType; // "car" | "motorcycle" | "truck"
  }

  // ---------------- Populate filter dropdowns (brand + category) ----------------
  async function populateFilterDropdowns() {
    const type = getVehicleType();
    if (!type) return;

    try {
      const [brandsRes, categoriesRes] = await Promise.all([
        api.get(`/brands?type=${type}`),
        api.get(`/categories?type=${type}`),
      ]);

      const brandSelect = document.getElementById('filterBrand');
      if (brandSelect) {
        brandsRes.data.forEach((b) => {
          const opt = document.createElement('option');
          opt.value = b._id;
          opt.textContent = b.name;
          brandSelect.appendChild(opt);
        });
      }

      const categorySelect = document.getElementById('filterCategory');
      if (categorySelect) {
        categoriesRes.data.forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c._id;
          opt.textContent = c.name.en;
          categorySelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('Failed to load filter options:', e.message);
    }
  }

  // ---------------- Build query params from current filter state ----------------
  function buildQueryParams() {
    const params = new URLSearchParams();

    const fields = {
      keyword: 'filterKeyword',
      brand: 'filterBrand',
      category: 'filterCategory',
      priceMin: 'filterPriceMin',
      priceMax: 'filterPriceMax',
      yearMin: 'filterYearMin',
      yearMax: 'filterYearMax',
      fuel: 'filterFuel',
      transmission: 'filterTransmission',
      mileageMax: 'filterMileage',
      condition: 'filterCondition',
      city: 'filterCity',
    };

    Object.entries(fields).forEach(([param, elId]) => {
      const el = document.getElementById(elId);
      if (el && el.value) params.set(param, el.value);
    });

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect && sortSelect.value) params.set('sort', sortSelect.value);

    params.set('page', state.page);
    params.set('limit', 12);

    return params;
  }

  // ---------------- Fetch + render ----------------
  async function fetchAndRenderResults() {
    const grid = document.getElementById('resultsGrid');
    const emptyState = document.getElementById('emptyState');
    const resultsCount = document.getElementById('resultsCount');
    if (!grid) return;

    const params = buildQueryParams();

    try {
      const res = await api.get(`/vehicles?${params.toString()}`);

      if (resultsCount) resultsCount.textContent = `${res.total} vehicles found`;

      if (res.data.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
      } else {
        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = res.data.map(renderVehicleCard).join('');
      }

      renderPagination(res.page, res.pages);
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  function renderPagination(currentPage, totalPages) {
    const container = document.getElementById('pagination');
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === currentPage ? 'is-active' : ''}" data-page="${i}">${i}</button>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.page = Number(btn.dataset.page);
        fetchAndRenderResults();
        window.scrollTo({ top: document.getElementById('resultsGrid').offsetTop - 100, behavior: 'smooth' });
      });
    });
  }

  // ---------------- Prefill filters from URL query string (e.g. from home search) ----------------
  function prefillFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const map = {
      keyword: 'filterKeyword',
      brand: 'filterBrand',
      priceMax: 'filterPriceMax',
      category: 'filterCategory',
    };
    Object.entries(map).forEach(([param, elId]) => {
      const value = urlParams.get(param);
      const el = document.getElementById(elId);
      if (value && el) el.value = value;
    });
  }

  function initFilterEvents() {
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        state.page = 1;
        fetchAndRenderResults();
        const sidebar = document.getElementById('filtersSidebar');
        if (sidebar) sidebar.classList.remove('is-open');
      });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.page = 1;
        fetchAndRenderResults();
      });
    }

    const clearBtn = document.getElementById('clearFilters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        document.querySelectorAll('.filter-group input, .filter-group select').forEach((el) => (el.value = ''));
        state.page = 1;
        fetchAndRenderResults();
      });
    }

    const mobileToggle = document.getElementById('filtersToggleMobile');
    const sidebar = document.getElementById('filtersSidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
    }

    const keywordInput = document.getElementById('filterKeyword');
    if (keywordInput) {
      keywordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (applyBtn) applyBtn.click();
        }
      });
    }
  }

  // ---------------- FAVORITES PAGE ----------------
  async function initFavoritesPage() {
    if (!document.body.classList.contains('page-favorites')) return;

    const authRequired = document.getElementById('authRequiredState');
    const emptyState = document.getElementById('emptyFavoritesState');
    const grid = document.getElementById('favoritesGrid');
    const countEl = document.getElementById('favoritesCount');

    if (!api.isLoggedIn()) {
      if (authRequired) authRequired.style.display = 'block';
      return;
    }

    try {
      const res = await api.get('/favorites');
      if (countEl) countEl.textContent = `${res.count} saved vehicles`;

      if (res.data.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      grid.innerHTML = res.data.map((f) => renderVehicleCard(f.vehicle)).join('');
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!getVehicleType()) {
      initFavoritesPage();
      return;
    }
    prefillFromUrl();
    await populateFilterDropdowns();
    initFilterEvents();
    fetchAndRenderResults();
  });
})();
