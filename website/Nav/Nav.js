document.addEventListener('DOMContentLoaded', async () => {
    const placeholders = document.querySelectorAll('[data-nav-placeholder]');

    if (!placeholders.length) {
        return;
    }

    try {
        const response = await fetch('/Nav/Nav.html', { cache: 'no-cache' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const navHtml = await response.text();
        placeholders.forEach((placeholder) => {
            placeholder.innerHTML = navHtml;
        });
    } catch (error) {
        console.error('Failed to load IntelliTest nav:', error);
    }
});
