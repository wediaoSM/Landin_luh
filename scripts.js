/* scripts.js — Versão completa (cole sobre o seu arquivo atual)
   - Recursos: year, page transition, intro modal, carrinho com thumbnails (extração robusta),
     reveal on scroll, lazy-load background, subtle tilt.
   - Observação: ajuste PLACEHOLDER se necessário.
*/


'use strict';



document.addEventListener('DOMContentLoaded', function () {
  /* =========================
     01. Year (rodapé)
     ========================= */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* =========================
     02. Page Transition overlay (cria se não existir)
     ========================= */
  function getTransitionOverlay() {
    let el = document.getElementById('page-transition');
    if (!el) {
      el = document.createElement('div');
      el.id = 'page-transition';
      el.className = 'page-transition';
      document.body.appendChild(el);
    }
    return el;
  }
  const overlay = getTransitionOverlay();
  if (overlay.classList.contains('opening')) {
    requestAnimationFrame(() => overlay.classList.remove('opening'));
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    const isSameOrigin = url.origin === location.origin;
    const goesToProdutos = /produtos\.html/i.test(url.pathname);
    if (!isSameOrigin || a.target === '_blank' || a.hasAttribute('download')) return;
    if (goesToProdutos) {
      e.preventDefault();
      overlay.classList.add('active');
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;
      setTimeout(() => { window.location.href = url.href; }, duration);
    }
  });

  /* =========================
     03. Intro modal da loja (produtos.html)
     ========================= */
  const isProdutosPage = /produtos\.html$/i.test(window.location.pathname);
  const introModal = document.getElementById('store-intro');

  if (isProdutosPage && introModal) {
    setTimeout(() => {
      introModal.setAttribute('aria-hidden', 'false');
    }, 120);
  }

  if (introModal) {
    document.addEventListener('click', (e) => {
      if (
        e.target.closest('.intro-close') ||
        e.target.closest('.intro-overlay') ||
        e.target.closest('[data-close]') ||
        e.target.closest('[data-intro-continue]')
      ) {
        introModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* =========================
     04. Carrinho (inicialização com extração de imagem robusta)
     ========================= */
  (function initCart() {
    const CART_KEY = 'lc_carrinho_v1';

    const $cartButton = document.getElementById('cart-button');
    const $cartCount = $cartButton?.querySelector('.cart-count');
    const $cartModal = document.getElementById('cart-modal');
    const $cartItemsList = document.querySelector('.cart-items');
    const $cartSubtotal = document.querySelector('.cart-subtotal');
    const $checkoutBtn = document.querySelector('.checkout-btn');

    // altere para seu placeholder real se quiser
    const PLACEHOLDER = 'Imagens/placeholder.png';

    let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

    // ---------- utilidades ----------
    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, function (s) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
      });
    }

    function save() {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      renderCartButton();
      renderCartModal();
    }

    function formatBRL(v) {
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // ---------- normalização/extracao de urls (imagens) ----------
    function normalizePath(p) {
      if (!p) return '';
      let s = String(p).trim();
      // extrai se vier em formato url("...") / url('...') / url(...)
      const m = s.match(/url\((['"]?)(.*?)\1\)/i);
      if (m && m[2]) s = m[2];
      // troca backslashes por slashes
      s = s.replace(/\\/g, '/');
      // remove aspas se ainda existirem
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1);
      }
      s = s.trim();
      try {
        s = encodeURI(s); // codifica espaços e caracteres especiais
      } catch (err) {
        s = s.replace(/ /g, '%20');
      }
      return s;
    }

    function extractBgUrl(el) {
      if (!el) return '';
      try {
        const inline = el.getAttribute && el.getAttribute('style');
        if (inline) {
          const inMatch = inline.match(/url\((['"]?)(.*?)\1\)/i);
          if (inMatch && inMatch[2]) return normalizePath(inMatch[2]);
        }
      } catch (e) {}
      try {
        if (el.style && el.style.backgroundImage && el.style.backgroundImage !== 'none') {
          const fromStyle = el.style.backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
          if (fromStyle && fromStyle[2]) return normalizePath(fromStyle[2]);
        }
      } catch (e) {}
      try {
        const cs = getComputedStyle(el);
        if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
          const fromComputed = cs.backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
          if (fromComputed && fromComputed[2]) return normalizePath(fromComputed[2]);
        }
      } catch (e) {}
      return '';
    }

    function findAnyBackgroundInCard(card) {
      if (!card) return '';
      const pimg = card.querySelector('.product-image');
      if (pimg) {
        const url = extractBgUrl(pimg);
        if (url) return url;
      }
      const all = card.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const node = all[i];
        const url = extractBgUrl(node);
        if (url) return url;
      }
      return '';
    }

    function imageFromCard(addBtn) {
      if (!addBtn) return '';
      // 1) data-image no botão
      try {
        if (addBtn.dataset && addBtn.dataset.image && addBtn.dataset.image.trim()) {
          return normalizePath(addBtn.dataset.image);
        }
      } catch (err) {}

      // 2) procurar o card mais próximo (classe .product-card ou ancestor)
      let card = addBtn.closest('.product-card') || addBtn.closest('[data-product-id]') || null;
      if (!card) {
        // sobe na árvore procurando um elemento que contenha imagem
        let node = addBtn.parentElement;
        while (node && node !== document.documentElement) {
          const img = node.querySelector && node.querySelector('img');
          if (img && img.src) return normalizePath(img.getAttribute('src') || img.src);
          node = node.parentElement;
        }
        return '';
      }

      // 3) <img> dentro do card (preferível)
      const imgs = card.querySelectorAll('img');
      for (let i = 0; i < imgs.length; i++) {
        const im = imgs[i];
        if (im && im.getAttribute('src')) {
          const srcAttr = im.getAttribute('src');
          // pula src vazio/data:
          if (srcAttr && !srcAttr.startsWith('data:')) return normalizePath(srcAttr);
        }
        if (im && im.dataset && (im.dataset.src || im.dataset.lazy)) {
          return normalizePath(im.dataset.src || im.dataset.lazy);
        }
      }

      // 4) data-image no próprio card
      try {
        if (card.dataset && card.dataset.image && card.dataset.image.trim()) return normalizePath(card.dataset.image.trim());
      } catch (err) {}

      // 5) background-image no .product-image ou em qualquer filho
      const found = findAnyBackgroundInCard(card);
      if (found) return found;

      console.warn('imageFromCard: imagem não encontrada para o produto — verifique .product-image ou <img> no card.', addBtn);
      return '';
    }

    // ---------- render / UI ----------
    function renderCartButton() {
      const totalCount = cart.reduce((s, i) => s + i.quantity, 0);
      if ($cartCount) {
        $cartCount.textContent = totalCount;
        if (totalCount === 0) $cartCount.setAttribute('aria-hidden', 'true');
        else $cartCount.removeAttribute('aria-hidden');
      }
    }

    function renderCartModal() {
      if (!$cartItemsList) return;
      $cartItemsList.innerHTML = '';
      const $empty = document.querySelector('.cart-empty');

      if (cart.length === 0) {
        if ($empty) $empty.style.display = 'block';
        if ($checkoutBtn) $checkoutBtn.disabled = true;
        if ($cartSubtotal) $cartSubtotal.textContent = formatBRL(0);
        return;
      }

      if ($empty) $empty.style.display = 'none';
      if ($checkoutBtn) $checkoutBtn.disabled = false;

      let subtotal = 0;
      cart.forEach(item => {
        subtotal += item.quantity * item.price;

        // normaliza/sanitiza a URL antes de usar
        const raw = item.image && item.image.trim() ? item.image : PLACEHOLDER;
        const imgSrcSafe = normalizePath(raw) || normalizePath(PLACEHOLDER);

        const li = document.createElement('li');
        li.className = 'cart-item';
        li.dataset.id = item.id;

        li.innerHTML = `
          <div class="item-thumb" aria-hidden="true">
            <img src="${imgSrcSafe}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='${normalizePath(PLACEHOLDER)}'" />
          </div>

          <div class="item-meta">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="unit-price">Unitário: ${formatBRL(item.price)}</div>
            <div class="item-total">Total: ${formatBRL(item.price * item.quantity)}</div>
          </div>

          <div class="item-controls">
            <div class="qty-controls" data-id="${item.id}">
              <button class="qty-btn qty-decrease" aria-label="Diminuir quantidade" data-id="${item.id}">−</button>
              <input type="number" class="qty-input" min="1" value="${item.quantity}" data-id="${item.id}" aria-label="Quantidade de ${escapeHtml(item.name)}" />
              <button class="qty-btn qty-increase" aria-label="Aumentar quantidade" data-id="${item.id}">+</button>
            </div>
            <button class="cart-remove" data-id="${item.id}" aria-label="Remover ${escapeHtml(item.name)}">Remover</button>
          </div>
        `;

        $cartItemsList.appendChild(li);
      });

      if ($cartSubtotal) $cartSubtotal.textContent = formatBRL(subtotal);
    }

    function showToast(message = 'Adicionado ao carrinho') {
      const $toast = document.getElementById('toast');
      if (!$toast) return;
      $toast.textContent = message;
      $toast.classList.add('show');
      $toast.setAttribute('aria-hidden', 'false');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => {
        $toast.classList.remove('show');
        $toast.setAttribute('aria-hidden', 'true');
      }, 1600);
    }

    function addToCart(product) {
      const existing = cart.find(i => i.id === product.id);
      if (existing) existing.quantity += 1;
      else cart.push({ ...product, quantity: 1 });
      save();
      showToast(`${product.name} adicionado`);
      if ($cartButton) {
        try {
          $cartButton.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 260 });
        } catch (err) { /* fallback: nada */ }
      }
    }

    function removeFromCart(id) {
      cart = cart.filter(i => i.id !== id);
      save();
    }

    function updateQty(id, qty) {
      const it = cart.find(i => i.id === id);
      if (!it) return;
      it.quantity = Math.max(1, qty);
      save();
    }

    function openCart() {
      if (!$cartModal) return;
      $cartModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      renderCartModal();
      const closeBtn = $cartModal.querySelector('.cart-close');
      if (closeBtn) closeBtn.focus();
    }

    function closeCart() {
      if (!$cartModal) return;
      $cartModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }

    // Delegação de eventos
    document.body.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.add-to-cart');
      if (addBtn) {
        const productImage = imageFromCard(addBtn) || '';
        const product = {
          id: addBtn.dataset.id || (addBtn.dataset.name ? addBtn.dataset.name.toLowerCase().replace(/\s+/g, '-') : String(Date.now())),
          name: addBtn.dataset.name || addBtn.getAttribute('aria-label') || 'Produto',
          price: parseFloat(addBtn.dataset.price || '0'),
          image: productImage
        };
        addToCart(product);
        return;
      }

      if (e.target.closest('#cart-button')) {
        openCart();
        return;
      }

      const inc = e.target.closest('.qty-increase');
      if (inc) {
        const id = inc.dataset.id;
        const it = cart.find(i => i.id === id);
        if (it) { it.quantity += 1; save(); }
        return;
      }

      const dec = e.target.closest('.qty-decrease');
      if (dec) {
        const id = dec.dataset.id;
        const it = cart.find(i => i.id === id);
        if (it) { it.quantity = Math.max(1, it.quantity - 1); save(); }
        return;
      }

      if (e.target.closest('.cart-remove')) {
        const id = e.target.closest('.cart-remove').dataset.id;
        removeFromCart(id);
        return;
      }

      if (e.target.closest('.cart-close') || e.target.closest('[data-close="true"]') || e.target.closest('.cart-continue')) {
        closeCart();
        return;
      }

      if (e.target.closest('.checkout-btn')) {
        if (cart.length === 0) return;

        let msg = 'Olá! Quero finalizar minha compra com os seguintes produtos:%0A';
        cart.forEach(item => {
          const itemTotal = item.price * item.quantity;
          msg += `• ${item.name} (x${item.quantity}) - ${itemTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}%0A`;
        });
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        msg += `%0ATotal: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}%0A`;

        const whatsapp = '5516992345492';
        const url = `https://wa.me/${whatsapp}?text=${msg}`;
        window.open(url, '_blank', 'noopener');
        return;
      }

      if (e.target.closest('.cart-clear')) {
        cart = [];
        save();
        showToast('Carrinho limpo');
        renderCartModal();
        return;
      }
    });

    // input para quantidade (digitando)
    document.body.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches('.qty-input')) {
        const id = el.dataset.id;
        const qty = parseInt(el.value, 10) || 1;
        updateQty(id, qty);
      }
    });

    // fechar modal ao clicar no overlay
    document.querySelectorAll('.cart-overlay').forEach(ov => {
      ov.addEventListener('click', () => closeCart());
    });

    // inicializa UI
    renderCartButton();
    renderCartModal();
  })();

  /* =========================
     05. Reveal on scroll (IntersectionObserver)
     ========================= */
  (function () {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  })();

  /* =========================
     06. Lazy-load backgrounds (data-src)
     ========================= */
  (function () {
    const lazyEls = document.querySelectorAll('[data-src]');
    if (lazyEls.length === 0) return;
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const src = el.getAttribute('data-src');
        if (src) {
          const bgEl = el.querySelector('.card-image') || el;
          if (bgEl) bgEl.style.backgroundImage = `url('${src}')`;
          el.removeAttribute('data-src');
        }
        obs.unobserve(el);
      });
    }, { rootMargin: '160px 0px' });

    lazyEls.forEach(e => io.observe(e));
  })();

  /* =========================
     07. Subtle tilt for .card elements (pointer)
     ========================= */
  (function () {
    const cards = document.querySelectorAll('.card');
    if (!cards.length) return;
    cards.forEach(card => {
      const rectHandler = (ev) => {
        const r = card.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width;
        const py = (ev.clientY - r.top) / r.height;
        const rotY = (px - 0.5) * 8;
        const rotX = (0.5 - py) * 6;
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        card.classList.add('tilt');
      };
      card.addEventListener('pointermove', rectHandler);
      card.addEventListener('pointerleave', () => { card.style.transform = ''; card.classList.remove('tilt'); });
    });
  })();

}); 

/* ==== PATCH: atualiza subtotal / badge automaticamente (colar no final de scripts.js) ==== */
(function () {
  'use strict';
  const CART_KEY = 'lc_carrinho_v1';

  function safeParse(v) {
    try { return JSON.parse(v || '[]'); } catch (e) { return []; }
  }

  function formatBRL(value) {
    return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function updateCartUIFromStorage() {
    try {
      const raw = localStorage.getItem(CART_KEY) || '[]';
      const cart = safeParse(raw);
      const subtotal = cart.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
      const count = cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

      // atualiza todos os subtotals encontrados
      document.querySelectorAll('.cart-subtotal').forEach(el => {
        el.textContent = formatBRL(subtotal);
      });

      // atualiza badge do botão do carrinho
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
        if (count === 0) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
      });

      // atualiza badge de itens no modal (se existir)
      document.querySelectorAll('.cart-items-badge').forEach(el => {
        el.textContent = `${count} item${count === 1 ? '' : 's'}`;
      });

      // se o modal estiver aberto, tenta garantir que o botão "checkout" esteja habilitado/desabilitado
      const checkout = document.querySelector('.checkout-btn');
      if (checkout) checkout.disabled = cart.length === 0;

      // se você quiser forçar a re-renderização da lista (opcional):
      // const itemsList = document.querySelector('.cart-items');
      // if (itemsList && itemsList.children.length === 0 && cart.length > 0) {
      //   // deixa sua lógica de renderização original cuidar disso; aqui só como fallback.
      // }

    } catch (err) {
      console.error('updateCartUIFromStorage error:', err);
    }
  }

  // observa alterações no localStorage (cross-tab)
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) updateCartUIFromStorage();
  });

  // intercepta cliques relevantes (add, qty, remove, clear) e atualiza UI logo depois
  document.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-cart') ||
        e.target.closest('.qty-increase') ||
        e.target.closest('.qty-decrease') ||
        e.target.closest('.cart-remove') ||
        e.target.closest('.cart-clear') ||
        e.target.closest('.checkout-btn')
    ) {
      // pequeno delay para garantir que a lógica do carrinho (do seu scripts.js) já tenha salvo no localStorage
      setTimeout(updateCartUIFromStorage, 140);
    }
  });

  // observa mudanças na lista .cart-items (caso seu código original re-rende a lista)
  const itemsContainer = document.querySelector('.cart-items');
  if (itemsContainer) {
    const mo = new MutationObserver(() => updateCartUIFromStorage());
    mo.observe(itemsContainer, { childList: true, subtree: true, attributes: false });
  }

  // roda uma vez ao carregar
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateCartUIFromStorage, 60);
  });

  // fallback: checa regularmente (tolerância mínima) caso nada mais detecte a mudança
  let last = localStorage.getItem(CART_KEY);
  setInterval(() => {
    const now = localStorage.getItem(CART_KEY);
    if (now !== last) { last = now; updateCartUIFromStorage(); }
  }, 700);
})();


// Spinner robusto: encontra inputs ou elementos de quantidade e adiciona overlay com botões
(function(){
  'use strict';

  function createSpinnerButtons() {
    var container = document.createElement('div');
    container.className = 'qty-spinner';
    var btnUp = document.createElement('button');
    btnUp.type = 'button';
    btnUp.className = 'spin-btn spin-up';
    btnUp.setAttribute('aria-label','Aumentar quantidade');
    btnUp.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 15l5-5 5 5z"/></svg>';
    var btnDown = document.createElement('button');
    btnDown.type = 'button';
    btnDown.className = 'spin-btn spin-down';
    btnDown.setAttribute('aria-label','Diminuir quantidade');
    btnDown.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 5 5-5z"/></svg>';
    container.appendChild(btnUp);
    container.appendChild(btnDown);
    return container;
  }

  // Tenta extrair número textual de um elemento
  function extractNumberFrom(el){
    if(!el) return 1;
    var txt = (el.value || el.textContent || el.innerText || '').trim();
    var m = txt.match(/-?\d+/);
    return m ? Number(m[0]) : 1;
  }

  // Garante wrapper .qty-controls.simple e injetar spinner
  function ensureSpinnerOn(targetEl){
    if(!targetEl || targetEl.dataset._spinnerProcessed === '1') return;
    targetEl.dataset._spinnerProcessed = '1';

    var input = null;
    if(targetEl.matches && targetEl.matches('input[type="number"]')){
      input = targetEl;
    }

    // Se o elemento não é input, procuramos um input filho; se não houver, criaremos um input oculto para sincronizar
    if(!input){
      input = targetEl.querySelector && targetEl.querySelector('input[type="number"]');
    }

    // Se ainda não achou, cria um input escondido para gerenciamento (mantemos o conteúdo visível original)
    var createdHidden = false;
    if(!input){
      input = document.createElement('input');
      input.type = 'number';
      input.min = targetEl.getAttribute && targetEl.getAttribute('data-min') || 1;
      input.step = targetEl.getAttribute && targetEl.getAttribute('data-step') || 1;
      input.value = extractNumberFrom(targetEl);
      input.style.display = 'none';
      input.classList.add('qty-input');
      createdHidden = true;
    } else {
      input.classList.add('qty-input');
    }

    // Se já existe wrapper, usar; senão criar
    var wrapper = targetEl.closest && targetEl.closest('.qty-controls');
    if(!wrapper){
      wrapper = document.createElement('div');
      wrapper.className = 'qty-controls simple';
      // inserir wrapper no lugar correto:
      if(createdHidden){
        // substitui targetEl por wrapper e insere o target dentro
        targetEl.parentNode.insertBefore(wrapper, targetEl);
        wrapper.appendChild(targetEl);
        wrapper.appendChild(input);
      } else {
        // se input existia em outro lugar, tentar envolver input
        if(input.parentNode) input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
      }
    } else {
      // se criamos input oculto, anexa ao wrapper
      if(createdHidden) wrapper.appendChild(input);
    }

    // Se criamos input oculto, sincronizar visual -> input quando alguém clicar no wrapper
    if(createdHidden){
      // manter o texto visível no targetEl; sempre que input mudar, atualizamos o texto
      input.addEventListener('input', function(){
        try{ targetEl.textContent = input.value; }catch(e){}
        input.dispatchEvent(new Event('change',{bubbles:true}));
      });
    }

    // Adiciona spinner se ainda não existe
    if(!wrapper.querySelector('.qty-spinner')){
      var spinner = createSpinnerButtons();
      wrapper.appendChild(spinner);
    }

    // opcional: debug outline
    // wrapper.classList.add('debug');

  }

  // Delegation para clicks nas setas
  document.addEventListener('click', function(e){
    var up = e.target.closest && e.target.closest('.spin-up');
    var down = e.target.closest && e.target.closest('.spin-down');
    if(!up && !down) return;
    e.preventDefault();
    var wrapper = (up||down).closest('.qty-controls');
    if(!wrapper) return;
    var input = wrapper.querySelector('input[type="number"].qty-input');
    if(!input){
      // tenta achar qualquer input numérico no wrapper
      input = wrapper.querySelector('input[type="number"]');
    }
    if(!input) return;
    var step = Number(input.getAttribute('step') || 1);
    var min = Number(input.getAttribute('min') || -Infinity);
    var max = input.hasAttribute('max') ? Number(input.getAttribute('max')) : Infinity;
    var value = Number(input.value || 0);
    if(up) value = Math.min(max, value + step);
    if(down) value = Math.max(min, value - step);
    input.value = value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });

  // Keyboard (setas) para inputs focados
  document.addEventListener('keydown', function(e){
    var el = document.activeElement;
    if(!el || !el.matches) return;
    if(!el.matches('input[type="number"].qty-input')) return;
    if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      e.preventDefault();
      var step = Number(el.getAttribute('step') || 1);
      var min = Number(el.getAttribute('min') || -Infinity);
      var max = el.hasAttribute('max') ? Number(el.getAttribute('max')) : Infinity;
      var val = Number(el.value || 0);
      if(e.key === 'ArrowUp') val = Math.min(max, val + step);
      else val = Math.max(min, val - step);
      el.value = val;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });

  // Seletores prováveis onde a quantidade pode estar no seu cart — amplie se necessário
  var quantitySelectors = [
    'input[type="number"]',               // inputs padrão
    '.qty, .quantity, .cart-qty, .item-qty', // spans/divs com qty
    '.qty-value', '.quantity-value', '.item-quantity'
  ];

  function scanAndAttach(root){
    quantitySelectors.forEach(function(sel){
      var nodes = root.querySelectorAll ? root.querySelectorAll(sel) : [];
      nodes.forEach(function(n){
        // se for um input numeric ou um elemento textual
        ensureSpinnerOn(n);
      });
    });
  }

  // PROCESSAMENTO inicial ao DOMContentLoaded (e logo após load)
  function init() {
    scanAndAttach(document);
    // Observer para elementos inseridos dinamicamente (ex.: seu script que renderiza itens do cart)
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(!m.addedNodes || !m.addedNodes.length) return;
        m.addedNodes.forEach(function(node){
          if(node.nodeType !== 1) return;
          // se o nó é diretamente um selector que usamos
          quantitySelectors.forEach(function(sel){
            if(node.matches && node.matches(sel)) ensureSpinnerOn(node);
            var nested = node.querySelectorAll && node.querySelectorAll(sel);
            if(nested && nested.length) nested.forEach(function(n){ ensureSpinnerOn(n); });
          });
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // também tentar após window.load para elementos muito atrasados
  window.addEventListener('load', function(){ scanAndAttach(document); });

})();


// Adapta spinner/quantidade automaticamente para não cobrir o número
(function(){
  function adaptQty() {
    document.querySelectorAll('.qty-controls.simple').forEach(function(w){
      var input = w.querySelector('input[type="number"]');
      var spinner = w.querySelector('.qty-spinner');
      if (!input) return;

      // limpa classes antigas
      w.classList.remove('compact','stack');

      // elemento que determina o espaço disponível (prioriza .item-controls, .cart-item, ou parent direto)
      var container = w.closest('.item-controls') || w.closest('.cart-item') || w.parentElement;
      var avail = container ? container.clientWidth : w.clientWidth;

      // medidas necessárias para exibir lado-a-lado
      var inW = input.offsetWidth || input.getBoundingClientRect().width || parseInt(getComputedStyle(input).width) || 44;
      var spW = spinner ? (spinner.offsetWidth || spinner.getBoundingClientRect().width || 28) : 0;
      var gap = 8;

      // se o wrapper não tiver espaço para input+spinner -> duas opções:
      // se super apertado: empilha (.stack). se levemente apertado: esconde spinner (.compact).
      if (avail && (inW + spW + gap) > avail) {
        // decide empilhar ou esconder: se avail < inW + 10 -> empilha
        if (avail < inW + 10) {
          w.classList.add('stack');
        } else {
          w.classList.add('compact');
        }
      } else {
        // cabe ao lado: remove flags
        w.classList.remove('compact','stack');
      }
    });
  }

  // Observadores e listeners
  window.addEventListener('resize', adaptQty);
  document.addEventListener('DOMContentLoaded', adaptQty);
  window.addEventListener('load', adaptQty);

  // observa mudanças no carrinho (itens adicionados/alterados)
  new MutationObserver(adaptQty).observe(document.body, { childList: true, subtree: true });

  // expõe para depuração se quiser executar manualmente no console: adaptQty()
  window.__adaptQty = adaptQty;
})();


// Aplica modo automaticamente e expõe toggleSpinnerMode()
(function(){
  function applyModeToAll() {
    document.querySelectorAll('.qty-controls.simple').forEach(function(w){
      w.classList.remove('overlay','above');
      var forced = w.getAttribute('data-mode'); // 'overlay'|'above'
      if (forced === 'overlay' || forced === 'above') {
        w.classList.add(forced);
        return;
      }
      var container = w.closest('.item-controls') || w.closest('.cart-item') || w.parentElement;
      var available = container ? container.clientWidth : w.clientWidth;
      var input = w.querySelector('input[type="number"]');
      var spinner = w.querySelector('.qty-spinner');
      var inputW = input ? (input.offsetWidth || 44) : 44;
      var spinnerW = spinner ? (spinner.offsetWidth || 28) : 28;
      var needed = inputW + spinnerW + 12;
      if (available && available < needed) w.classList.add('above');
      else w.classList.add('overlay');
    });
  }

  window.addEventListener('load', applyModeToAll);
  window.addEventListener('resize', applyModeToAll);
  document.addEventListener('DOMContentLoaded', applyModeToAll);
  new MutationObserver(applyModeToAll).observe(document.body, { childList:true, subtree:true });

  // Para debug no console:
  window.toggleSpinnerMode = function(mode){
    if(mode === 'overlay' || mode === 'above'){
      document.querySelectorAll('.qty-controls.simple').forEach(w => { w.classList.remove('overlay','above'); w.classList.add(mode); w.setAttribute('data-mode', mode); });
    } else {
      document.querySelectorAll('.qty-controls.simple').forEach(w => w.removeAttribute('data-mode'));
      applyModeToAll();
    }
  };
})();

/* === HIDE TOP PROMO at <=400px (colar no final de scripts.js) === */
(function(){
  'use strict';

  // seletores que queremos esconder em 400px (adapte se necessário)
  const PROMO_SELECTORS = [
    '.hero-visual',
    '.bubble',
    '.hero-promo',
    '.promo-banner',
    '.top-promo',
    '.banner-highlight',
    '.promo-highlight',
    '.promo',
    '.banner--promo',
    '.highlight-banner',
    '.hero .promo',
    '#promo',
    '#top-promo'
  ];

  // debounce util
  function debounce(fn, wait){
    let t;
    return function(){
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), wait || 120);
    };
  }

  // aplica/retira visibilidade
  function setPromoHidden(hide){
    PROMO_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        try {
          if (hide) {
            // salva estilo original (se ainda não salvo)
            if (el.dataset._origDisplay === undefined) el.dataset._origDisplay = el.style.display || '';
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.setAttribute('aria-hidden', 'true');
            // opcional: reduzir espaço residual
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('margin', '0', 'important');
            el.style.setProperty('padding', '0', 'important');
            el.dataset._promoHidden = '1';
          } else {
            // restaura
            if (el.dataset._promoHidden) {
              if (el.dataset._origDisplay) el.style.display = el.dataset._origDisplay;
              else el.style.removeProperty('display');
              el.style.removeProperty('visibility');
              el.style.removeProperty('height');
              el.style.removeProperty('margin');
              el.style.removeProperty('padding');
              el.removeAttribute('aria-hidden');
              delete el.dataset._promoHidden;
              delete el.dataset._origDisplay;
            }
          }
        } catch (err) {
          // não quebra se algum elemento estiver protegido
          console.warn('promo hide error', err);
        }
      });
    });

    // opcional: adiciona uma classe ao <html> para facilitar debugging/CSS
    document.documentElement.classList.toggle('promo-hidden-400', hide);
  }

  // verifica media query e aplica
  const mql = window.matchMedia('(max-width: 400px)');
  function checkAndApply(){
    setPromoHidden(mql.matches);
  }

  // inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndApply);
  } else {
    checkAndApply();
  }

  // escuta mudanças de media query e resize
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', checkAndApply);
  else if (typeof mql.addListener === 'function') mql.addListener(checkAndApply);

  window.addEventListener('resize', debounce(checkAndApply, 150));
})();

/* Intro modal behavior: show once, close handlers (overlay/btn/ESC) */
(function(){
  var modal = document.getElementById('store-intro');
  if (!modal) return;

  var overlay = modal.querySelector('.intro-overlay');
  var closeBtns = modal.querySelectorAll('[data-close], .intro-close');
  var continueBtn = modal.querySelector('[data-intro-continue]');

  function openModal() {
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    // focus management
    var close = modal.querySelector('.intro-close');
    if (close) close.focus();
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  // attach handlers
  if (overlay) overlay.addEventListener('click', closeModal);
  closeBtns.forEach(function(b){ b.addEventListener('click', closeModal); });
  if (continueBtn) continueBtn.addEventListener('click', function(){
    closeModal();
    // optional: open cart or scroll to products
    var target = document.querySelector('.products-grid');
    if (target) target.scrollIntoView({behavior:'smooth', block:'start'});
  });

  // ESC to close
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });

  // show automatically on first visit (localStorage flag). Delay small para não chocar o usuário.
  try {
    if (!localStorage.getItem('lc_intro_shown')) {
      setTimeout(openModal, 650);
      localStorage.setItem('lc_intro_shown', '1');
    }
  } catch (err) {
    // se localStorage bloqueado, apenas abre uma vez por sessão:
    if (!window.__lc_intro_seen) { setTimeout(openModal, 650); window.__lc_intro_seen = true; }
  }
})();
