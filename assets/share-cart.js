class ShareCart extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector('button');
    this.url = this.dataset.url;

    this.handleClick = this.handleClick.bind(this);
  }

  connectedCallback() {
    if (!this.button) return;

    this.originalText = this.button.textContent;

    this.button.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.handleClick);
  }

  async handleClick(event) {
    event.preventDefault();

    // First click
    if (this.button.textContent.trim() === this.originalText) {
      this.button.textContent = 'Copy Link';
      return;
    }

    // Second click
    if (this.button.textContent.trim() === 'Copy Link') {
      try {
        await navigator.clipboard.writeText(this.url);

        this.button.textContent = 'Copied!';
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
  }
}

customElements.define('share-cart', ShareCart);
