/**
 * vehicle-details.js
 * -----------------------------------------------------------------------
 * Powers vehicle-details.html: fetches the vehicle by its `id` query
 * param, renders the gallery, specs, seller card, and similar vehicles,
 * wires up the favorite toggle, WhatsApp/Call buttons, and the inquiry form.
 * -----------------------------------------------------------------------
 */

(function () {
  function getVehicleIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function renderGallery(images, title) {
    const wrapper = document.getElementById('galleryWrapper');
    const thumbsWrapper = document.getElementById('galleryThumbsWrapper');
    const list = images && images.length > 0 ? images : [{ url: 'https://via.placeholder.com/1200x750?text=No+Image' }];

    wrapper.innerHTML = list.map((img) => `<div class="swiper-slide"><img src="${img.url}" alt="${title}" /></div>`).join('');
    thumbsWrapper.innerHTML = list.map((img) => `<div class="swiper-slide"><img src="${img.url}" alt="${title} thumbnail" /></div>`).join('');

    if (window.Swiper) {
      const thumbsSwiper = new Swiper('#galleryThumbs', {
        slidesPerView: 5,
        spaceBetween: 10,
        watchSlidesProgress: true,
      });
      new Swiper('.gallery-swiper', {
        navigation: { nextEl: '.gallery-swiper .swiper-button-next', prevEl: '.gallery-swiper .swiper-button-prev' },
        thumbs: { swiper: thumbsSwiper },
      });
    }
  }

  function renderSpecs(vehicle) {
    const specs = [
      ['Brand', vehicle.brand ? vehicle.brand.name : '—'],
      ['Model', vehicle.model],
      ['Year', vehicle.year],
      ['Mileage', `${Number(vehicle.mileage).toLocaleString()} km`],
      ['Fuel', vehicle.fuel],
      ['Transmission', vehicle.transmission],
      ['Engine', vehicle.engine || '—'],
      ['Horsepower', vehicle.horsepower ? `${vehicle.horsepower} HP` : '—'],
      ['Color', vehicle.color || '—'],
      ['Condition', vehicle.condition],
    ];
    document.getElementById('specsGrid').innerHTML = specs
      .map(([label, value]) => `<div class="spec-item"><span>${label}</span><span>${value}</span></div>`)
      .join('');
  }

  function renderSeller(vehicle) {
    const seller = vehicle.seller || {};
    document.getElementById('sellerAvatar').src = seller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name || 'Seller')}&background=1B1B1B&color=fff`;
    document.getElementById('sellerName').textContent = seller.name || 'Unknown Seller';
    document.getElementById('sellerSince').textContent = seller.createdAt
      ? `Member since ${new Date(seller.createdAt).getFullYear()}`
      : '';

    const whatsappBtn = document.getElementById('whatsappBtn');
    const callBtn = document.getElementById('callBtn');
    const phone = (seller.phone || '').replace(/[^0-9+]/g, '');
    if (phone) {
      whatsappBtn.href = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(`Hi, I'm interested in your ${vehicle.title}`)}`;
      callBtn.href = `tel:${phone}`;
    } else {
      whatsappBtn.style.display = 'none';
      callBtn.style.display = 'none';
    }
  }

  async function renderSimilar(vehicleId) {
    try {
      const res = await api.get(`/vehicles/${vehicleId}/similar`);
      document.getElementById('similarVehiclesGrid').innerHTML = res.data.map(renderVehicleCard).join('');
    } catch (e) {
      // non-critical section — fail silently
    }
  }

  function initFavoriteButton(vehicleId) {
    const btn = document.getElementById('favoriteToggle');
    const isFav = window.__favoriteIds && window.__favoriteIds.has(vehicleId);
    if (isFav) {
      btn.classList.add('is-active');
      btn.querySelector('i').className = 'fa-solid fa-heart';
    }
    btn.dataset.favId = vehicleId; // reuse the global delegated handler from main.js
  }

  function initContactForm(vehicle) {
    const form = document.getElementById('contactSellerForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!api.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
      }

      const content = document.getElementById('messageContent').value.trim();
      if (!content) return;

      try {
        await api.post('/messages', { vehicleId: vehicle._id, content });
        alert('Your message has been sent to the seller!');
        form.reset();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  async function loadVehicle() {
    const id = getVehicleIdFromUrl();
    if (!id) {
      document.getElementById('vehicleDetailsRoot').innerHTML = '<p class="text-muted">Vehicle not found.</p>';
      return;
    }

    try {
      const res = await api.get(`/vehicles/${id}`);
      const vehicle = res.data;

      document.title = `${vehicle.title} | Moamenoon Cars`;
      document.getElementById('breadcrumbTitle').textContent = vehicle.title;
      document.getElementById('vehicleTitle').textContent = vehicle.title;
      document.getElementById('vehiclePrice').textContent = `${vehicle.currency} ${Number(vehicle.price).toLocaleString()}`;
      document.getElementById('vehicleLocation').textContent = `${vehicle.location.city}, ${vehicle.location.country}`;
      document.getElementById('vehicleViews').textContent = vehicle.views;
      document.getElementById('vehicleDescription').textContent = vehicle.description;
      document.getElementById('conditionBadge').textContent = vehicle.condition;
      document.getElementById('mapLocationLabel').textContent = `${vehicle.location.city}, ${vehicle.location.country}`;

      renderGallery(vehicle.images, vehicle.title);
      renderSpecs(vehicle);
      renderSeller(vehicle);
      initContactForm(vehicle);
      renderSimilar(vehicle._id);
      initFavoriteButton(vehicle._id);
    } catch (err) {
      document.getElementById('vehicleDetailsRoot').innerHTML = `<p class="text-muted">${err.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', loadVehicle);
})();
