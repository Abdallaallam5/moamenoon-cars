/**
 * dashboard.js
 * -----------------------------------------------------------------------
 * Powers dashboard.html (admin only): panel switching, overview stats,
 * vehicle table + approval actions, add/edit vehicle form with image
 * upload, brand & category management, and user management.
 * -----------------------------------------------------------------------
 */

(function () {
  // Panels that fetch their data lazily, the first time they're opened
  // (analytics in particular needs its <canvas> elements to be visible
  // before Chart.js can measure them correctly).
  const lazyPanelLoaders = {
    'panel-analytics': () => loadAnalytics(),
    'panel-messages': () => loadMessages(),
    'panel-reviews': () => loadReviews(),
  };
  const loadedPanels = new Set();

  // ---------------- Panel switching ----------------
  function initPanelSwitching() {
    const navItems = document.querySelectorAll('.dash-nav__item');
    const title = document.getElementById('dashPanelTitle');

    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        navItems.forEach((i) => i.classList.remove('is-active'));
        document.querySelectorAll('.dash-panel').forEach((p) => p.classList.remove('is-active'));

        item.classList.add('is-active');
        document.getElementById(item.dataset.target).classList.add('is-active');
        title.textContent = item.querySelector('span').textContent;

        document.getElementById('dashSidebar').classList.remove('is-open');

        const target = item.dataset.target;
        if (lazyPanelLoaders[target] && !loadedPanels.has(target)) {
          loadedPanels.add(target);
          lazyPanelLoaders[target]();
        }
      });
    });

    document.getElementById('dashBurger')?.addEventListener('click', () => {
      document.getElementById('dashSidebar').classList.toggle('is-open');
    });
  }

  function setDashAvatar() {
    const user = api.getUser();
    if (!user) return;
    document.getElementById('dashAvatar').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=C1121F&color=fff`;
  }

  // ---------------- OVERVIEW ----------------
  async function loadOverview() {
    try {
      const res = await api.get('/users/dashboard-stats');
      const s = res.data;
      document.getElementById('statTotalUsers').textContent = s.totalUsers;
      document.getElementById('statTotalVehicles').textContent = s.totalVehicles;
      document.getElementById('statPendingVehicles').textContent = s.pendingVehicles;
      document.getElementById('statApprovedVehicles').textContent = s.approvedVehicles;
      document.getElementById('statTotalMessages').textContent = s.totalMessages;
    } catch (e) {
      console.error(e.message);
    }

    try {
      const res = await api.get('/vehicles?status=pending&limit=5');
      document.getElementById('pendingReviewTable').innerHTML = buildVehiclesTable(res.data, true);
      bindVehicleTableActions();
    } catch (e) {
      console.error(e.message);
    }
  }

  // ---------------- ANALYTICS ----------------
  const chartInstances = {}; // keyed by canvas id, so we can destroy & redraw safely

  const CHART_COLORS = ['#C1121F', '#E63946', '#F5A623', '#2ECC71', '#3B82F6', '#A78BFA'];

  function renderChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }
    chartInstances[canvasId] = new Chart(canvas, config);
  }

  const chartBaseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#c9c9c9' } } },
    scales: {
      x: { ticks: { color: '#9a9a9a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#9a9a9a' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
    },
  };

  function typeLabel(type) {
    return { car: 'Cars', motorcycle: 'Motorcycles', truck: 'Trucks' }[type] || type || 'Unknown';
  }

  async function loadAnalytics() {
    try {
      const res = await api.get('/analytics/overview');
      const d = res.data;

      document.getElementById('statTotalViews').textContent = d.totalViews;
      document.getElementById('statTotalBrands').textContent = d.totals.totalBrands;
      document.getElementById('statTotalCategories').textContent = d.totals.totalCategories;
      document.getElementById('statTotalReviews').textContent = d.totals.totalReviews;

      // Listings trend (line)
      renderChart('chartListingsTrend', {
        type: 'line',
        data: {
          labels: d.listingsTrend.map((p) => p.label),
          datasets: [
            {
              label: 'New Listings',
              data: d.listingsTrend.map((p) => p.count),
              borderColor: '#C1121F',
              backgroundColor: 'rgba(193,18,31,0.15)',
              tension: 0.35,
              fill: true,
            },
          ],
        },
        options: chartBaseOptions,
      });

      // Users trend (line)
      renderChart('chartUsersTrend', {
        type: 'line',
        data: {
          labels: d.usersTrend.map((p) => p.label),
          datasets: [
            {
              label: 'New Users',
              data: d.usersTrend.map((p) => p.count),
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59,130,246,0.15)',
              tension: 0.35,
              fill: true,
            },
          ],
        },
        options: chartBaseOptions,
      });

      // By status (doughnut)
      renderChart('chartByStatus', {
        type: 'doughnut',
        data: {
          labels: d.vehiclesByStatus.map((s) => s.status),
          datasets: [{ data: d.vehiclesByStatus.map((s) => s.count), backgroundColor: CHART_COLORS }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#c9c9c9' } } } },
      });

      // By type (bar)
      renderChart('chartByType', {
        type: 'bar',
        data: {
          labels: d.vehiclesByType.map((t) => typeLabel(t.type)),
          datasets: [{ label: 'Listings', data: d.vehiclesByType.map((t) => t.count), backgroundColor: CHART_COLORS }],
        },
        options: { ...chartBaseOptions, plugins: { legend: { display: false } } },
      });

      // Top brands (bar)
      renderChart('chartTopBrands', {
        type: 'bar',
        data: {
          labels: d.topBrands.map((b) => b.name),
          datasets: [{ label: 'Listings', data: d.topBrands.map((b) => b.count), backgroundColor: '#E63946' }],
        },
        options: { ...chartBaseOptions, indexAxis: 'y', plugins: { legend: { display: false } } },
      });

      // Top cities (bar)
      renderChart('chartTopCities', {
        type: 'bar',
        data: {
          labels: d.topCities.map((c) => c.city || 'Unknown'),
          datasets: [{ label: 'Listings', data: d.topCities.map((c) => c.count), backgroundColor: '#F5A623' }],
        },
        options: { ...chartBaseOptions, indexAxis: 'y', plugins: { legend: { display: false } } },
      });

      // Price stats table
      const priceTable = document.getElementById('priceStatsTable');
      priceTable.innerHTML = d.priceStats.length
        ? `<table>
            <thead><tr><th>Type</th><th>Avg Price</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>
              ${d.priceStats
                .map(
                  (p) => `<tr><td>${typeLabel(p.type)}</td><td>${p.avgPrice.toLocaleString()}</td><td>${p.minPrice.toLocaleString()}</td><td>${p.maxPrice.toLocaleString()}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>`
        : `<p class="text-muted">No approved listings yet.</p>`;

      // Most viewed table
      const viewedTable = document.getElementById('mostViewedTable');
      viewedTable.innerHTML = d.mostViewed.length
        ? `<table>
            <thead><tr><th>Title</th><th>Brand</th><th>Views</th><th>Price</th></tr></thead>
            <tbody>
              ${d.mostViewed
                .map(
                  (v) => `<tr><td>${v.title}</td><td>${v.brand ? v.brand.name : '—'}</td><td>${v.views}</td><td>${v.price} ${v.currency}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>`
        : `<p class="text-muted">No views yet.</p>`;

      // Recent activity feed
      const feed = document.getElementById('recentActivityFeed');
      const activityItems = [
        ...d.recentActivity.vehicles.map((v) => ({
          icon: 'fa-car',
          text: `New listing "${v.title}" (${v.status})`,
          time: v.createdAt,
        })),
        ...d.recentActivity.users.map((u) => ({
          icon: 'fa-user-plus',
          text: `New user registered: ${u.name} (${u.role})`,
          time: u.createdAt,
        })),
        ...d.recentActivity.messages.map((m) => ({
          icon: 'fa-envelope',
          text: `${m.sender ? m.sender.name : 'Someone'} sent a message about "${m.vehicle ? m.vehicle.title : 'a listing'}"`,
          time: m.createdAt,
        })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time));

      feed.innerHTML = activityItems.length
        ? activityItems
            .slice(0, 10)
            .map(
              (a) => `<div class="activity-item"><i class="fa-solid ${a.icon}"></i><span>${a.text}</span><time>${new Date(a.time).toLocaleString()}</time></div>`
            )
            .join('')
        : `<p class="text-muted">No recent activity.</p>`;
    } catch (e) {
      console.error(e.message);
    }
  }

  // ---------------- VEHICLES TABLE ----------------
  function buildVehiclesTable(vehicles, compact = false) {
    if (vehicles.length === 0) return `<p class="text-muted">No vehicles found.</p>`;

    return `
      <table>
        <thead><tr><th></th><th>Title</th><th>Price</th><th>Status</th><th>Seller</th><th>Actions</th></tr></thead>
        <tbody>
          ${vehicles
            .map((v) => {
              const img = v.primaryImage || (v.images && v.images[0] && v.images[0].url) || 'https://via.placeholder.com/80x56';
              return `
              <tr data-vehicle-id="${v._id}">
                <td><img class="table-thumb" src="${img}" alt="" /></td>
                <td>${v.title}</td>
                <td>${v.price} ${v.currency}</td>
                <td><span class="badge badge--${v.status}">${v.status}</span></td>
                <td>${v.seller ? v.seller.name : '—'}</td>
                <td class="table-actions">
                  ${
                    v.status === 'pending'
                      ? `<button class="btn-approve" data-action="approve" title="Approve"><i class="fa-solid fa-check"></i></button>
                         <button class="btn-reject" data-action="reject" title="Reject"><i class="fa-solid fa-xmark"></i></button>`
                      : ''
                  }
                  <button data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
  }

  function bindVehicleTableActions() {
    document.querySelectorAll('.dash-table [data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('[data-vehicle-id]');
        const id = row.dataset.vehicleId;
        const action = btn.dataset.action;

        try {
          if (action === 'approve') {
            await api.put(`/vehicles/${id}/status`, { status: 'approved' });
          } else if (action === 'reject') {
            const reason = prompt('Reason for rejection (optional):') || '';
            await api.put(`/vehicles/${id}/status`, { status: 'rejected', rejectionReason: reason });
          } else if (action === 'delete') {
            if (!confirm('Delete this vehicle permanently?')) return;
            await api.delete(`/vehicles/${id}`);
          } else if (action === 'edit') {
            loadVehicleIntoForm(id);
            document.querySelector('[data-target="panel-add-vehicle"]').click();
            return;
          }
          loadAllVehicles();
          loadOverview();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  async function loadAllVehicles() {
    const table = document.getElementById('allVehiclesTable');
    if (!table) return;

    const keyword = document.getElementById('vehicleSearchInput')?.value || '';
    const status = document.getElementById('vehicleStatusFilter')?.value || '';

    const params = new URLSearchParams({ limit: 50 });
    if (keyword) params.set('keyword', keyword);
    if (status) params.set('status', status);
    else params.set('status', 'any'); // admin sees all statuses by default

    try {
      const res = await api.get(`/vehicles?${params.toString()}`);
      table.innerHTML = buildVehiclesTable(res.data);
      bindVehicleTableActions();
    } catch (err) {
      table.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  function initVehiclesPanel() {
    document.getElementById('vehicleSearchInput')?.addEventListener('input', debounce(loadAllVehicles, 400));
    document.getElementById('vehicleStatusFilter')?.addEventListener('change', loadAllVehicles);
  }

  // ---------------- ADD / EDIT VEHICLE FORM ----------------
  // Full brand/category lists, cached so the type toggle can filter them
  // client-side instead of re-fetching on every click.
  let allBrandsCache = [];
  let allCategoriesCache = [];
  let selectedVehicleType = 'car';

  function renderBrandOptions(type) {
    const brandSelect = document.getElementById('vBrand');
    const filtered = allBrandsCache.filter((b) => !b.types || b.types.length === 0 || b.types.includes(type));
    const list = filtered.length ? filtered : allBrandsCache; // fall back to all if none tagged for this type
    brandSelect.innerHTML = list.map((b) => `<option value="${b._id}">${b.name}</option>`).join('');
  }

  function renderCategoryOptions(type) {
    const categorySelect = document.getElementById('vCategory');
    const filtered = allCategoriesCache.filter((c) => c.type === type);
    const list = filtered.length ? filtered : allCategoriesCache;
    categorySelect.innerHTML = list.map((c) => `<option value="${c._id}">${c.name.en}</option>`).join('');
  }

  function setVehicleType(type) {
    selectedVehicleType = type;
    document.querySelectorAll('#vTypeToggle .type-toggle__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.type === type);
    });
    renderBrandOptions(type);
    renderCategoryOptions(type);
  }

  function initTypeToggle() {
    document.querySelectorAll('#vTypeToggle .type-toggle__btn').forEach((btn) => {
      btn.addEventListener('click', () => setVehicleType(btn.dataset.type));
    });
  }

  async function populateVehicleFormDropdowns() {
    try {
      const [brands, categories] = await Promise.all([api.get('/brands'), api.get('/categories')]);
      allBrandsCache = brands.data;
      allCategoriesCache = categories.data;
      setVehicleType(selectedVehicleType);
    } catch (e) {
      console.error(e.message);
    }
  }

  // ---------------- Image preview ----------------
  function initImagePreview() {
    document.getElementById('vImages')?.addEventListener('change', (e) => {
      const preview = document.getElementById('vImagesPreview');
      preview.innerHTML = '';
      Array.from(e.target.files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const wrap = document.createElement('div');
          wrap.className = 'image-preview-item' + (index === 0 ? ' is-primary' : '');
          wrap.innerHTML = `<img src="${ev.target.result}" alt="" />${index === 0 ? '<span class="image-preview-item__badge">Cover</span>' : ''}`;
          preview.appendChild(wrap);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function loadVehicleIntoForm(id) {
    document.getElementById('vehicleFormTitle').textContent = 'Edit Vehicle';
    document.getElementById('vehicleFormSubmit').textContent = 'Update Vehicle';

    api
      .get(`/vehicles/${id}`)
      .then((res) => {
        const v = res.data;
        const type = (v.category && v.category.type) || 'car';
        setVehicleType(type);

        document.getElementById('vehicleEditId').value = v._id;
        document.getElementById('vTitle').value = v.title;
        document.getElementById('vModel').value = v.model;
        document.getElementById('vDescription').value = v.description;
        document.getElementById('vCategory').value = v.category._id || v.category;
        document.getElementById('vBrand').value = v.brand._id || v.brand;
        document.getElementById('vYear').value = v.year;
        document.getElementById('vMileage').value = v.mileage;
        document.getElementById('vFuel').value = v.fuel;
        document.getElementById('vTransmission').value = v.transmission;
        document.getElementById('vEngine').value = v.engine || '';
        document.getElementById('vHorsepower').value = v.horsepower || '';
        document.getElementById('vColor').value = v.color || '';
        document.getElementById('vCondition').value = v.condition;
        document.getElementById('vPrice').value = v.price;
        document.getElementById('vCurrency').value = v.currency;
        document.getElementById('vCity').value = v.location.city;
        document.getElementById('vCountry').value = v.location.country;

        // Show existing images in the preview strip (view-only; new uploads append)
        const preview = document.getElementById('vImagesPreview');
        preview.innerHTML = (v.images || [])
          .map((img, i) => `<div class="image-preview-item${img.isPrimary ? ' is-primary' : ''}"><img src="${img.url}" alt="" />${img.isPrimary ? '<span class="image-preview-item__badge">Cover</span>' : ''}</div>`)
          .join('');
      })
      .catch((err) => alert(err.message));
  }

  function resetVehicleForm() {
    document.getElementById('vehicleForm').reset();
    document.getElementById('vehicleEditId').value = '';
    document.getElementById('vehicleFormTitle').textContent = 'Add Vehicle';
    document.getElementById('vehicleFormSubmit').textContent = 'Save Vehicle';
    document.getElementById('vImagesPreview').innerHTML = '';
    setVehicleType('car');
  }

  function initVehicleForm() {
    const form = document.getElementById('vehicleForm');
    if (!form) return;

    document.getElementById('vehicleFormCancel')?.addEventListener('click', resetVehicleForm);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('vehicleEditId').value;
      const formData = new FormData();

      formData.append('title', document.getElementById('vTitle').value);
      formData.append('model', document.getElementById('vModel').value);
      formData.append('description', document.getElementById('vDescription').value);
      formData.append('category', document.getElementById('vCategory').value);
      formData.append('brand', document.getElementById('vBrand').value);
      formData.append('year', document.getElementById('vYear').value);
      formData.append('mileage', document.getElementById('vMileage').value);
      formData.append('fuel', document.getElementById('vFuel').value);
      formData.append('transmission', document.getElementById('vTransmission').value);
      formData.append('engine', document.getElementById('vEngine').value);
      formData.append('horsepower', document.getElementById('vHorsepower').value);
      formData.append('color', document.getElementById('vColor').value);
      formData.append('condition', document.getElementById('vCondition').value);
      formData.append('price', document.getElementById('vPrice').value);
      formData.append('currency', document.getElementById('vCurrency').value);
      formData.append('location[city]', document.getElementById('vCity').value);
      formData.append('location[country]', document.getElementById('vCountry').value);

      const files = document.getElementById('vImages').files;
      Array.from(files).forEach((file) => formData.append('images', file));

      try {
        if (id) {
          await api.put(`/vehicles/${id}`, formData, true);
          alert('Vehicle updated successfully');
        } else {
          await api.post('/vehicles', formData, true);
          alert('Vehicle created successfully');
        }
        resetVehicleForm();
        loadAllVehicles();
        loadOverview();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ---------------- BRANDS ----------------
  async function loadBrands() {
    const table = document.getElementById('brandsTable');
    if (!table) return;
    try {
      const res = await api.get('/brands');
      table.innerHTML = `
        <table>
          <thead><tr><th>Logo</th><th>Name</th><th>Listings</th><th>Actions</th></tr></thead>
          <tbody>
            ${res.data
              .map(
                (b) => `
              <tr data-brand-id="${b._id}">
                <td><img class="table-thumb" src="${b.logo || 'https://via.placeholder.com/60x40'}" alt="" /></td>
                <td>${b.name}</td>
                <td>${b.listingsCount}</td>
                <td class="table-actions"><button data-brand-action="delete"><i class="fa-solid fa-trash"></i></button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

      table.querySelectorAll('[data-brand-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('[data-brand-id]').dataset.brandId;
          if (!confirm('Delete this brand?')) return;
          await api.delete(`/brands/${id}`);
          loadBrands();
        });
      });
    } catch (err) {
      table.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  function initAddBrand() {
  document.getElementById('addBrandBtn')?.addEventListener('click', async () => {
    const name = prompt('Brand name:');
    if (!name) return;

    const types =
      prompt('Vehicle types (comma-separated: car,motorcycle,truck):', 'car') || 'car';

    // إنشاء input مخفي لاختيار اللوجو
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = async () => {
      const formData = new FormData();

      formData.append('name', name);

      types.split(',').forEach((t) => {
        formData.append('types[]', t.trim());
      });

      // مهم: اسم الحقل لازم يكون logo
      if (fileInput.files.length > 0) {
        formData.append('logo', fileInput.files[0]);
      }

      try {
        await api.post('/brands', formData, true);
        alert('Brand added successfully');
        loadBrands();
      } catch (err) {
        alert(err.message);
      }
    };

    fileInput.click();
  });
}

  // ---------------- CATEGORIES ----------------
  async function loadCategories() {
    const table = document.getElementById('categoriesTable');
    if (!table) return;
    try {
      const res = await api.get('/categories');
      table.innerHTML = `
        <table>
          <thead><tr><th>Name (EN)</th><th>Name (AR)</th><th>Type</th><th>Featured</th><th>Actions</th></tr></thead>
          <tbody>
            ${res.data
              .map(
                (c) => `
              <tr data-category-id="${c._id}">
                <td>${c.name.en}</td>
                <td>${c.name.ar}</td>
                <td>${c.type}</td>
                <td>${c.isFeatured ? 'Yes' : 'No'}</td>
                <td class="table-actions"><button data-category-action="delete"><i class="fa-solid fa-trash"></i></button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

      table.querySelectorAll('[data-category-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('[data-category-id]').dataset.categoryId;
          if (!confirm('Delete this category?')) return;
          await api.delete(`/categories/${id}`);
          loadCategories();
        });
      });
    } catch (err) {
      table.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  function initAddCategory() {
    document.getElementById('addCategoryBtn')?.addEventListener('click', async () => {
      const nameEn = prompt('Category name (English):');
      if (!nameEn) return;
      const nameAr = prompt('Category name (Arabic):', nameEn) || nameEn;
      const type = prompt('Vehicle type (car / motorcycle / truck):', 'car') || 'car';

      try {
        await api.post('/categories', { name: { en: nameEn, ar: nameAr }, type: type.trim() });
        loadCategories();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ---------------- USERS ----------------
  async function loadUsers() {
    const table = document.getElementById('usersTable');
    if (!table) return;
    try {
      const res = await api.get('/users');
      table.innerHTML = `
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${res.data
              .map(
                (u) => `
              <tr data-user-id="${u._id}">
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>
                  <select data-user-action="role">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="seller" ${u.role === 'seller' ? 'selected' : ''}>Seller</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>
                </td>
                <td><span class="badge badge--${u.isActive ? 'approved' : 'rejected'}">${u.isActive ? 'Active' : 'Disabled'}</span></td>
                <td class="table-actions">
                  <button data-user-action="toggle-active" title="Toggle Active"><i class="fa-solid fa-power-off"></i></button>
                  <button data-user-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

      table.querySelectorAll('[data-user-action="role"]').forEach((select) => {
        select.addEventListener('change', async () => {
          const id = select.closest('[data-user-id]').dataset.userId;
          try {
            await api.put(`/users/${id}`, { role: select.value });
          } catch (err) {
            alert(err.message);
          }
        });
      });

      table.querySelectorAll('[data-user-action="toggle-active"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const row = btn.closest('[data-user-id]');
          const id = row.dataset.userId;
          const isActive = row.querySelector('.badge').textContent.trim() === 'Active';
          try {
            await api.put(`/users/${id}`, { isActive: !isActive });
            loadUsers();
          } catch (err) {
            alert(err.message);
          }
        });
      });

      table.querySelectorAll('[data-user-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('[data-user-id]').dataset.userId;
          if (!confirm('Delete this user permanently?')) return;
          try {
            await api.delete(`/users/${id}`);
            loadUsers();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      table.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  // ---------------- MESSAGES ----------------
  let allMessagesCache = [];

  function buildMessagesTable(messages) {
    if (messages.length === 0) return `<p class="text-muted">No messages found.</p>`;
    return `
      <table>
        <thead><tr><th>Vehicle</th><th>From</th><th>To</th><th>Message</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${messages
            .map(
              (m) => `
            <tr data-message-id="${m._id}">
              <td>${m.vehicle ? m.vehicle.title : '—'}</td>
              <td>${m.sender ? m.sender.name : m.name || 'Guest'}</td>
              <td>${m.receiver ? m.receiver.name : '—'}</td>
              <td class="table-cell-truncate">${m.content}</td>
              <td><span class="badge badge--${m.isRead ? 'approved' : 'pending'}">${m.isRead ? 'Read' : 'Unread'}</span></td>
              <td>${new Date(m.createdAt).toLocaleDateString()}</td>
              <td class="table-actions"><button data-message-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  function bindMessagesActions() {
    document.querySelectorAll('#messagesTable [data-message-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('[data-message-id]').dataset.messageId;
        if (!confirm('Delete this message permanently?')) return;
        try {
          await api.delete(`/messages/${id}`);
          loadMessages();
          loadOverview();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  async function loadMessages() {
    const table = document.getElementById('messagesTable');
    if (!table) return;
    try {
      const res = await api.get('/messages/admin/all');
      allMessagesCache = res.data;
      table.innerHTML = buildMessagesTable(allMessagesCache);
      bindMessagesActions();
    } catch (err) {
      table.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  function initMessagesPanel() {
    document.getElementById('messageSearchInput')?.addEventListener(
      'input',
      debounce((e) => {
        const keyword = e.target.value.toLowerCase();
        const filtered = allMessagesCache.filter(
          (m) =>
            m.content.toLowerCase().includes(keyword) ||
            (m.sender && m.sender.name.toLowerCase().includes(keyword)) ||
            (m.vehicle && m.vehicle.title.toLowerCase().includes(keyword))
        );
        document.getElementById('messagesTable').innerHTML = buildMessagesTable(filtered);
        bindMessagesActions();
      }, 300)
    );
  }

  // ---------------- REVIEWS ----------------
  function buildReviewsTable(reviews) {
    if (reviews.length === 0) return `<p class="text-muted">No reviews found.</p>`;
    return `
      <table>
        <thead><tr><th>Reviewer</th><th>Seller</th><th>Rating</th><th>Comment</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${reviews
            .map(
              (r) => `
            <tr data-review-id="${r._id}">
              <td>${r.reviewer ? r.reviewer.name : '—'}</td>
              <td>${r.seller ? r.seller.name : '—'}</td>
              <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
              <td class="table-cell-truncate">${r.comment || '—'}</td>
              <td><span class="badge badge--${r.isApproved ? 'approved' : 'pending'}">${r.isApproved ? 'Visible' : 'Hidden'}</span></td>
              <td class="table-actions">
                <button data-review-action="toggle" title="Toggle visibility"><i class="fa-solid fa-eye${r.isApproved ? '-slash' : ''}"></i></button>
                <button data-review-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  function bindReviewsActions() {
    document.querySelectorAll('#reviewsTable [data-review-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('[data-review-id]').dataset.reviewId;
        const action = btn.dataset.reviewAction;
        try {
          if (action === 'toggle') {
            await api.put(`/reviews/${id}/approve`, {});
          } else if (action === 'delete') {
            if (!confirm('Delete this review permanently?')) return;
            await api.delete(`/reviews/${id}`);
          }
          loadReviews();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  async function loadReviews() {
    const table = document.getElementById('reviewsTable');
    if (!table) return;
    try {
      const res = await api.get('/reviews/admin/all');
      table.innerHTML = buildReviewsTable(res.data);
      bindReviewsActions();
    } catch (err) {
      table.innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  // ---------------- Utility: debounce ----------------
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  document.addEventListener('DOMContentLoaded', async () => {
    setDashAvatar();
    initPanelSwitching();
    initTypeToggle();
    initImagePreview();
    initVehiclesPanel();
    initVehicleForm();
    initAddBrand();
    initAddCategory();
    initMessagesPanel();

    await populateVehicleFormDropdowns();

    loadOverview();
    loadAllVehicles();
    loadBrands();
    loadCategories();
    loadUsers();
    // Analytics / Messages / Reviews panels load lazily the first time
    // their nav item is clicked (see lazyPanelLoaders above).
  });
})();
