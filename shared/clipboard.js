(function () {
  // The async clipboard API is the only path that works without a focused
  // element, but it is unavailable or denied in some contexts - notably older
  // Firefox for Android - so the textarea path stays as a fallback.
  window.copyTextToClipboard = async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Fall through to the fallback below.
      }
    }

    let textarea;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      return document.execCommand('copy');
    } catch (error) {
      return false;
    } finally {
      textarea?.remove();
    }
  };
})();
