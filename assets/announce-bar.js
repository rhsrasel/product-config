class AnnouncementBar extends HTMLElement {
  constructor() {
    super();

    this.storageKey = 'dismissed-announcements';

    this.messages = [...this.querySelectorAll('[data-message]')];
  }

  connectedCallback() {
    this.restoreDismissedMessages();
    this.handleVisibility();
    this.bindEvents();
  }

  bindEvents() {
    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-dismiss]');

      if (!button) return;

      const message = button.closest('[data-message]');

      if (!message) return;

      this.dismissMessage(message);
    });
  }

  getDismissedMessages() {
    return JSON.parse(sessionStorage.getItem(this.storageKey) || '[]');
  }

  setDismissedMessages(messages) {
    sessionStorage.setItem(this.storageKey, JSON.stringify(messages));
  }

  dismissMessage(message) {
    const id = message.dataset.id;

    const dismissedMessages = this.getDismissedMessages();

    if (!dismissedMessages.includes(id)) {
      dismissedMessages.push(id);

      this.setDismissedMessages(dismissedMessages);
    }

    message.remove();
    this.handleVisibility();
  }

  restoreDismissedMessages() {
    const dismissedMessages = this.getDismissedMessages();

    this.messages.forEach((message) => {
      const id = message.dataset.id;

      if (dismissedMessages.includes(id)) {
        message.remove();
      }
    });
  }

  handleVisibility() {
    const dismissedMessages = this.getDismissedMessages();

    const totalMessages = this.messages.length;

    // All dismissed
    if (dismissedMessages.length >= totalMessages) {
      this.remove();

      return;
    }

    // At least one visible
    this.classList.remove('hidden');
  }
}

if (!customElements.get('announcement-bar')) {
  customElements.define('announcement-bar', AnnouncementBar);
}
