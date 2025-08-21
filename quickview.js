/* quickview.js — corrigido: adiciona .qv-inner para o CSS aplicar corretamente */
(function () {
  let lastFocused = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    ensureQuickView();
    autoTagQuickview();
    bindQuickViewTriggers();
    setupDelegation();
    setupObserver();
    console.log('[quickview] triggers iniciais:', document.querySelectorAll('[data-quickview]').length);
  }

  function ensureQuickView() {
    if (document.getElementById('quickview')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'quickview-modal';
    wrapper.id = 'quickview';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');
    wrapper.style.display = 'none';

    // IMPORTANT: criamos .quickview-panel e **.qv-inner** (para que o CSS aplique)
    wrapper.innerHTML = `
      <div class="quickview-overlay" data-qv-close></div>
      <div class="quickview-panel" role="document">
        <div class="qv-inner">
          <div class="quickview-head">
            <h3 class="quickview-title"></h3>
            <button class="quickview-close" type="button" aria-label="Fechar" data-qv-close>✕</button>
          </div>
          <div class="quickview-body"></div>
          <div class="quickview-actions">
            <button class="btn-secondary" type="button" data-qv-close>Fechar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // fechar clicando no overlay ou em qualquer elemento com data-qv-close
    wrapper.addEventListener('click', (e) => {
      if (e.target.matches('[data-qv-close]')) closeQuickView();
    });

    // fechar com Escape
    document.addEventListener('keydown', (e) => {
      if (isOpen() && e.key === 'Escape') closeQuickView();
    });
  }

  function bindQuickViewTriggers() {
    const triggers = document.querySelectorAll('[data-quickview]');
    triggers.forEach((el) => {
      setTriggerA11y(el);
      el.addEventListener('click', () => openFromTrigger(el));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFromTrigger(el);
        }
      });
    });
  }

  function autoTagQuickview(root = document) {
    const candidates = root.querySelectorAll?.('.card:not([data-quickview]), .product-card:not([data-quickview]), .product-banner:not([data-quickview])') || [];
    candidates.forEach((el) => {
      el.setAttribute('data-quickview', '');
      setTriggerA11y(el);
    });
  }

  function setTriggerA11y(el) {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  }

  function setupDelegation() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest?.('[data-quickview]');
      if (!trigger) return;
      const link = e.target.closest('a[href]');
      if (link && trigger.contains(link)) e.preventDefault();
      openFromTrigger(trigger);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const trigger = e.target.closest?.('[data-quickview]');
      if (!trigger) return;
      e.preventDefault();
      openFromTrigger(trigger);
    });
  }

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('.product-card, .product-banner, .card')) {
            autoTagQuickview(node.ownerDocument || document);
            setTriggerA11y(node);
            node.setAttribute('data-quickview', '');
          } else {
            autoTagQuickview(node);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // === abre modal a partir do card clicado ===
  function openFromTrigger(el) {
    const title =
      el.dataset.title ||
      el.querySelector('.product-info h3')?.textContent?.trim() ||
      el.querySelector('h3')?.textContent?.trim() ||
      'Detalhes do produto';

    let desc = el.dataset.desc ||
      el.querySelector('.product-info p')?.textContent?.trim() ||
      el.querySelector('p')?.textContent?.trim() ||
      '';

    let img = el.dataset.img || el.querySelector('img')?.src || null;

    // flags
    const isPontoSlim = /ponto\s*slim/i.test(title) || el.dataset.product === 'ponto-slim';
    const isAdesivoSlim = /adesivo\s*slim/i.test(title) || el.dataset.product === 'adesivo-slim';
    // NOVO: Ponto Americano
    const isPontoAmericano = /ponto\s*americano/i.test(title) || el.dataset.product === 'ponto-americano';

    if (isPontoSlim) {
      desc = `✨ Ponto Slim

O Ponto Slim é um método indicado principalmente para cabelos cacheados.
Ele é feito com base e costura em tela, onde o cabelo natural fica solto, diferente do entrelace tradicional.
Esse diferencial garante mais leveza, naturalidade e versatilidade no movimento dos fios.
Especial para cabelos cacheados (mas pode ser usado em outros tipos também)
Não aperta e não agride a raiz
Estrutura fina e discreta
Mais conforto e naturalidade`;
      img = null;
    } else if (isAdesivoSlim) {
      desc = `✨ Adesivo Slim

O Adesivo Slim é uma técnica moderna feita com fitas adesivas ultrafinas, ideais para quem busca alongamento e volume com naturalidade, conforto e leveza.
As fitas são imperceptíveis ao toque e não marcam na raiz.

✅ Indicado para cabelos lisos e ondulados
✅ Aplicação rápida e prática
✅ Conforto no dia a dia
✅ Naturalidade no acabamento`;
      img = null;
    } else if (isPontoAmericano) {
      // NOVO: texto do card 4 (Ponto Americano)
      desc = `✨ O que é o Ponto Americano?

O Ponto Americano é um método de alongamento em que a tela de cabelo é fixada ao natural através de uma costura fina e resistente.
Ele garante um resultado natural, leve e confortável`;
      img = null;
    }

    // passa info pro modal
    openQuickView({ title, desc, img, opener: el, removeTitle: isPontoSlim || isAdesivoSlim || isPontoAmericano });
  }

  // === monta e mostra modal ===
  function openQuickView({ title, desc, img, opener, removeTitle = false }) {
    const modal = document.getElementById('quickview');
    if (!modal) return;
    const titleEl = modal.querySelector('.quickview-title');
    const bodyEl = modal.querySelector('.quickview-body');

    // define título ou remove se precisar
    if (removeTitle) {
      titleEl.textContent = ''; // limpa completamente
    } else {
      titleEl.textContent = title || 'Detalhes do produto';
    }

    // limpa corpo
    bodyEl.innerHTML = '';

    // adiciona imagem se tiver
    if (img) {
      const image = new Image();
      image.src = img;
      image.alt = title || '';
      image.loading = 'lazy';
      bodyEl.appendChild(image);
    }

    // adiciona descrição
    if (desc) {
      const wrapper = document.createElement('div');
      wrapper.className = 'quickview-desc';
      const paragraphs = desc.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      wrapper.innerHTML = paragraphs
        .map(p => p.replace(/\n/g, '<br>'))
        .map(p => `<p>${p}</p>`)
        .join('');
      bodyEl.appendChild(wrapper);
    }

    lastFocused = opener || document.activeElement;

    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const closeBtn = modal.querySelector('.quickview-close');
    closeBtn?.focus({ preventScroll: true });
  }

  function closeQuickView() {
    const modal = document.getElementById('quickview');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');

    if (lastFocused && typeof lastFocused.focus === 'function') {
      setTimeout(() => lastFocused.focus({ preventScroll: true }), 0);
    }
  }

  function isOpen() {
    const modal = document.getElementById('quickview');
    return modal && modal.getAttribute('aria-hidden') === 'false';
  }
})();

/* -----------------------
   quickview-enh.js (CTA WhatsApp)
   ----------------------- */
(function () {
  const phone = '5516992345492'; // seu número sem + ou espaços (ajuste se necessário)
  const templateText = encodeURIComponent('Olá, tenho interesse no produto que vi no site.');

  function ensureCTA() {
    const modal = document.getElementById('quickview');
    if (!modal) return;
    const actions = modal.querySelector('.quickview-actions');
    if (!actions) return;
    if (actions.querySelector('.qv-cta-wp')) return;

    const a = document.createElement('a');
    a.className = 'qv-cta-wp';
    a.href = `https://wa.me/${phone}?text=${templateText}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="margin-right:6px;filter:brightness(1.05)"><path fill="white" d="M20.52 3.48A11.91 11.91 0 0 0 12 0C5.373 0 .01 5.373.01 12 0 13.987.497 15.88 1.43 17.56L0 24l6.63-1.37A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12 0-3.2-1.26-6.15-3.48-8.52z"/><path fill="white" d="M17.472 14.382c-.297-.149-1.758-.868-2.03-.968-.273-.099-.472-.148-.672.149-.198.297-.768.968-.942 1.168-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.884-.789-1.48-1.763-1.653-2.06-.173-.297-.018-.458.13-.607.134-.133.298-.347.447-.52.151-.173.201-.298.301-.497.099-.198.05-.372-.025-.52-.074-.148-.672-1.62-.921-2.218-.242-.583-.487-.503-.672-.513l-.573-.01c-.198 0-.52.074-.793.372s-1.04 1.017-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.4.2.7.2 1 .1.3-.1 1.8-.6 2.1-1.3.2-.6.2-1.1.2-1.3 0-.1-.3-.2-.6-.3z"/></svg>WhatsApp';
    const ref = actions.querySelector('button, a') || null;
    if (ref) {
      actions.insertBefore(a, ref);
    } else {
      actions.appendChild(a);
    }
  }

  const observer = new MutationObserver((mut) => {
    for (const m of mut) {
      if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
        const modal = m.target;
        if (modal.getAttribute('aria-hidden') === 'false') {
          setTimeout(ensureCTA, 40);
        }
      }
    }
  });

  const modal = document.getElementById('quickview');
  if (modal) {
    observer.observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
  } else {
    const bodyObs = new MutationObserver((mut) => {
      for (const m of mut) {
        m.addedNodes.forEach(n => {
          if (n instanceof Element && n.id === 'quickview') {
            observer.observe(n, { attributes: true, attributeFilter: ['aria-hidden'] });
            bodyObs.disconnect();
          }
        });
      }
    });
    bodyObs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();


/* center-gallery.js
   Carrossel pequeno para o card central (.banners .card.center).
   Uso: coloque data-gallery="img1.jpg, img2.jpg, img3.jpg" no <article class="card center">.
   Se não houver data-gallery, o script pega todas <img> dentro do próprio card como fallback.
*/
(function () {
  const SELECTOR = '.banners .card.center';

  let modal, imgEl, captionEl, dotsEl;
  let imgs = [];
  let idx = 0;

  function ensureModal() {
    if (document.getElementById('center-gallery-modal')) return document.getElementById('center-gallery-modal');

    modal = document.createElement('div');
    modal.id = 'center-gallery-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="cg-overlay" data-cg-close></div>
      <div class="cg-panel" role="dialog" aria-modal="true">
        <button class="cg-close" aria-label="Fechar" data-cg-close>✕</button>
        <div class="cg-stage">
          <button class="cg-arrow cg-prev" aria-label="Anterior">&#10094;</button>
          <img src="" alt="" draggable="false" />
          <button class="cg-arrow cg-next" aria-label="Próximo">&#10095;</button>
        </div>
        <div class="cg-caption" aria-live="polite"></div>
        <div class="cg-dots" role="tablist" aria-label="Imagens"></div>
      </div>
    `;
    document.body.appendChild(modal);

    imgEl = modal.querySelector('.cg-stage img');
    captionEl = modal.querySelector('.cg-caption');
    dotsEl = modal.querySelector('.cg-dots');

    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-cg-close]')) close();
    });
    modal.querySelector('.cg-prev').addEventListener('click', showPrev);
    modal.querySelector('.cg-next').addEventListener('click', showNext);
    modal.querySelector('.cg-close').addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });

    // swipe touch
    let startX = 0;
    modal.querySelector('.cg-stage').addEventListener('touchstart', (ev) => startX = ev.changedTouches[0].clientX, { passive: true });
    modal.querySelector('.cg-stage').addEventListener('touchend', (ev) => {
      const dx = ev.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 30) return;
      if (dx > 0) showPrev(); else showNext();
    }, { passive: true });

    return modal;
  }

  function parseGalleryFromCard(card) {
    // prioridade: data-gallery (comma or pipe separated)
    const raw = card.dataset.gallery;
    if (raw && raw.trim()) {
      // split by comma or pipe
      const parts = raw.split(/\s*(?:,|\|)\s*/).map(s => s.trim()).filter(Boolean);
      return parts.map(s => ({ src: s, alt: '' }));
    }
    // fallback: todas as imgs internas do card
    const imgsNode = Array.from(card.querySelectorAll('img'));
    if (imgsNode.length) {
      return imgsNode.map(img => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' }));
    }
    // sem imagens
    return [];
  }

  function openForCard(card, start = 0) {
    if (!card) return;
    // fecha quickview caso esteja aberto (compatibilidade)
    const q = document.getElementById('quickview');
    if (q && q.getAttribute('aria-hidden') === 'false') {
      q.setAttribute('aria-hidden', 'true');
      q.style.display = 'none';
      document.body.classList.remove('modal-open');
    }

    imgs = parseGalleryFromCard(card);
    if (!imgs.length) {
      console.warn('[center-gallery] Nenhuma imagem disponível neste card (use data-gallery ou coloque <img> dentro do card).');
      return;
    }

    idx = Math.max(0, Math.min(start, imgs.length - 1));
    ensureModal();
    renderDots();
    update();
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    // foco
    setTimeout(() => modal.querySelector('.cg-close')?.focus(), 30);
  }

  function close() {
    const m = document.getElementById('center-gallery-modal');
    if (!m) return;
    m.setAttribute('aria-hidden', 'true');
    m.style.display = 'none';
    document.body.classList.remove('modal-open');
    // limpa src para liberar
    const im = m.querySelector('.cg-stage img');
    if (im) { im.src = ''; im.alt = ''; }
  }

  function isOpen() {
    const m = document.getElementById('center-gallery-modal');
    return m && m.getAttribute('aria-hidden') === 'false';
  }

  function update() {
    const item = imgs[idx];
    if (!item) return;
    // transição suave
    imgEl.style.opacity = '0';
    setTimeout(() => {
      imgEl.src = item.src;
      imgEl.alt = item.alt || (`Imagem ${idx + 1} de ${imgs.length}`);
      captionEl.textContent = item.alt ? item.alt : `Imagem ${idx + 1} de ${imgs.length}`;
      updateDots();
      setTimeout(() => imgEl.style.opacity = '1', 20);
    }, 120);
  }

  function showPrev() { idx = (idx - 1 + imgs.length) % imgs.length; update(); }
  function showNext() { idx = (idx + 1) % imgs.length; update(); }

  function renderDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    imgs.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Ir para imagem ${i + 1}`);
      b.addEventListener('click', () => { idx = i; update(); });
      dotsEl.appendChild(b);
    });
    updateDots();
  }

  function updateDots() {
    if (!dotsEl) return;
    Array.from(dotsEl.children).forEach((b, i) => b.classList.toggle('active', i === idx));
  }

  // bind: só no card central para evitar disparos indesejados
  function bindToCenterCard() {
    const card = document.querySelector(SELECTOR);
    if (!card) {
      // observa o DOM e tenta novamente caso o card seja injetado depois
      const obs = new MutationObserver((mut) => {
        for (const m of mut) {
          for (const n of m.addedNodes) {
            if (n instanceof Element && n.matches && n.matches(SELECTOR)) {
              obs.disconnect();
              attach(n);
              return;
            }
          }
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      return;
    }
    attach(card);
  }

  function attach(card) {
    if (card.__cgBound) return;
    card.__cgBound = true;

    card.addEventListener('click', function (e) {
      // evita abrir se clicou em link interno
      if (e.target.closest('a')) return;
      e.preventDefault();
      e.stopPropagation(); // impede quickview de receber o click
      openForCard(card, 0);
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        openForCard(card, 0);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindToCenterCard);
  else bindToCenterCard();
})();


