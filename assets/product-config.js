class ProductConfigurator extends HTMLElement {
  constructor() {
    super();

    this.currentStep = 1;
    this.completedSteps = new Set();
    this.formData = {};
    this.moneyFmt = this.dataset.moneyFormat;
    this.debounceTimers = {};
    this.basePrice = Number(this.dataset.basePrice || 0);
    this.totalPrice = this.basePrice;
  }

  connectedCallback() {
    this.selectors();
    this.bindEvents();
    this.updateUI();
    this.renderResult();
    this.initializeConditionalFields();
    this.updatePrice();
  }

  selectors() {
    this.stepButtons = this.querySelectorAll('[data-step-button]');
    this.stepPanels = this.querySelectorAll('[data-step-panel]');
    this.completeButtons = this.querySelectorAll('[data-complete-step]');
    this.addToCartButton = this.querySelector('[data-add-to-cart]');
    this.result = this.querySelector('[data-result]');
    this.totalPriceElement = this.querySelector('[data-total-price]');
  }

  formatMoney(cents) {
    cents = Number(cents);

    if (isNaN(cents)) {
      cents = 0;
    }

    const amount = (cents / 100).toFixed(2);

    return this.moneyFmt
      .replace('{{amount}}', amount)
      .replace('{{amount_no_decimals}}', Math.round(cents / 100))
      .replace('{{amount_with_comma_separator}}', amount.replace('.', ','));
  }

  bindEvents() {
    // Step navigation
    this.stepButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.stepButton);

        if (!this.isStepAccessible(step)) return;

        this.currentStep = step;
        this.updateUI();
      });
    });

    // Complete Step
    this.completeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const panel = button.closest('[data-step-panel]');
        const step = Number(panel.dataset.stepPanel);

        if (!this.validateStep(panel)) {
          alert('Please complete required fields');
          return;
        }

        this.completedSteps.add(step);
        if (step < this.stepPanels.length) {
          this.currentStep = step + 1;
        }

        this.updateUI();
        this.updateAddToCart();
      });
    });

    // Change
    this.addEventListener('change', (event) => {
      const field = event.target;

      if (!field.matches('[data-field]')) return;

      this.updateFieldValue(field);

      if (field.hasAttribute('data-conditional-trigger')) {
        this.handleConditional(field);
      }

      this.updatePrice();
      this.renderResult();
    });

    // Debounced text input
    this.addEventListener('input', (event) => {
      const field = event.target;

      if (!field.matches('[data-field]')) return;

      const isTextField = field.type === 'text' || field.tagName === 'TEXTAREA';

      if (!isTextField) return;

      clearTimeout(this.debounceTimers[field.name]);

      this.debounceTimers[field.name] = setTimeout(() => {
        this.updateFieldValue(field);
        this.renderResult();
      }, 300);
    });

    // Add To Cart
    this.addToCartButton?.addEventListener('click', () => this.addToCart());
  }

  updateUI() {
    this.stepPanels.forEach((panel) => {
      const step = Number(panel.dataset.stepPanel);

      panel.classList.toggle('is-active', step === this.currentStep);
    });

    this.stepButtons.forEach((button) => {
      const step = Number(button.dataset.stepButton);

      button.classList.remove('disabled', 'completed', 'is-active');

      if (step === this.currentStep) {
        button.classList.add('is-active');
      }

      if (this.completedSteps.has(step)) {
        button.classList.add('completed');
      }

      if (!this.isStepAccessible(step)) {
        button.classList.add('disabled');
      }
    });
  }

  isStepAccessible(step) {
    if (step === 1) {
      return true;
    }

    return this.completedSteps.has(step - 1);
  }

  validateStep(panel) {
    const processedRadioGroups = new Set();

    const fields = panel.querySelectorAll('[data-field]');

    for (const field of fields) {
      const wrapper = field.closest('[data-conditional-wrapper]');

      if (wrapper && wrapper.classList.contains('hidden')) {
        continue;
      }

      if (!field.required) {
        continue;
      }

      // Radio
      if (field.type === 'radio') {
        const group = field.name;

        if (processedRadioGroups.has(group)) {
          continue;
        }

        processedRadioGroups.add(group);

        const checked = panel.querySelector(`[name="${group}"]:checked`);

        if (!checked) {
          return false;
        }

        continue;
      }

      // Checkbox
      if (field.type === 'checkbox') {
        if (!field.checked) {
          return false;
        }

        continue;
      }

      // Text / Select
      if (!field.value.trim()) {
        return false;
      }
    }

    return true;
  }

  handleConditional(trigger) {
    const triggerName = trigger.name;

    let triggerValue = '';

    if (trigger.type === 'radio') {
      const checked = this.querySelector(`[name="${triggerName}"]:checked`);
      triggerValue = checked?.value || '';
    } else {
      triggerValue = trigger.value;
    }

    const wrappers = this.querySelectorAll(`[data-conditional-field="${triggerName}"]`);

    wrappers.forEach((wrapper) => {
      const operator = wrapper.dataset.conditionalOperator;
      const expected = wrapper.dataset.conditionalValue;

      let shouldShow = false;

      if (operator === 'equals') {
        shouldShow = triggerValue === expected;
      }

      if (operator === 'not_equals') {
        shouldShow = triggerValue !== expected;
      }

      wrapper.classList.toggle('hidden', !shouldShow);

      // Reset hidden fields
      if (!shouldShow) {
        const fields = wrapper.querySelectorAll('[data-field]');

        fields.forEach((field) => {
          delete this.formData[field.name];

          if (field.type === 'radio') {
            field.checked = false;
          } else if (field.type === 'checkbox') {
            field.checked = false;
          } else {
            field.value = '';
          }
        });
      }
    });

    this.updatePrice();
    this.renderResult();
  }

  updateFieldValue(field) {
    const key = field.name;

    if (!key) return;

    // Radio
    if (field.type === 'radio') {
      if (field.checked) {
        this.formData[key] = field.value;
      }

      return;
    }

    // Checkbox
    if (field.type === 'checkbox') {
      this.formData[key] = field.checked;

      return;
    }

    // Text / Select
    this.formData[key] = field.value;
  }

  updatePrice() {
    // Base price already cents
    let total = this.basePrice;

    // Radios
    const checkedRadios = this.querySelectorAll('input[type="radio"]:checked');

    checkedRadios.forEach((input) => {
      const price = Number(input.dataset.priceAdder || 0) * 100;

      total += price;
    });

    // Selects
    const selects = this.querySelectorAll('select[data-field]');

    selects.forEach((select) => {
      const selectedOption = select.options[select.selectedIndex];

      if (!selectedOption) {
        return;
      }

      const price = Number(selectedOption.dataset.priceAdder || 0) * 100;

      total += price;
    });

    this.totalPrice = total;
    this.renderPrice();
  }

  renderPrice() {
    if (!this.totalPriceElement) {
      return;
    }

    this.totalPriceElement.innerHTML = this.formatMoney(this.totalPrice);
  }

  renderResult() {
    if (!this.result) {
      return;
    }

    this.result.textContent = JSON.stringify(this.formData, null, 2);

    const html = Object.entries(this.formData)
      .map(([key, value]) => {
        return `<p><strong>${key}:</strong> ${value}</p>`;
      })
      .join('');

    this.result.innerHTML = html;
  }

  updateAddToCart() {
    const completed = this.completedSteps.size === this.stepPanels.length;
    this.addToCartButton.disabled = !completed;
    this.addToCartButton.textContent = completed ? 'Add To Cart' : 'Complete all steps to add';
  }

  async addToCart() {
    if (this.addToCartButton.disabled) {
      return;
    }

    try {
      this.addToCartButton.disabled = true;
      this.addToCartButton.textContent = 'Adding...';

      // Variant ID
      const variantId = Number(this.dataset.variantId);

      // Line item properties
      const properties = { ...this.formData };

      const sectionsToRender = this.getSectionsToRender().map((section) => section.id);

      const payload = {
        id: variantId,
        quantity: 1,
        properties: properties,
        sections: sectionsToRender,
        sections_url: window.location.pathname,
      };

      // Ajax Cart API
      const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }

      const newParsedState = await response.json();

      this.addToCartButton.textContent = 'Added To Cart';

      const cart = document.querySelector('cart-drawer');
      cart.renderContents(newParsedState);
      cart.classList.contains('is-empty') && cart.classList.remove('is-empty');
    } catch (error) {
      console.error(error);

      this.addToCartButton.textContent = 'Add To Cart';

      alert('Failed to add product');
    } finally {
      setTimeout(() => {
        this.addToCartButton.disabled = false;

        this.updateAddToCart();
      }, 1000);
    }
  }

  // Initialize Conditional
  initializeConditionalFields() {
    const triggers = this.querySelectorAll('[data-conditional-trigger]');

    triggers.forEach((trigger) => {
      if (trigger.type === 'radio' && trigger.checked) {
        this.handleConditional(trigger);
      }

      if (trigger.tagName === 'SELECT') {
        this.handleConditional(trigger);
      }
    });
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }
}

if (!customElements.get('product-configurator')) {
  customElements.define('product-configurator', ProductConfigurator);
}
