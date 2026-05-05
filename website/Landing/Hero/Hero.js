document.addEventListener('DOMContentLoaded', async () => {
    const placeholders = document.querySelectorAll('[data-hero-placeholder]');

    if (!placeholders.length) {
        return;
    }

    try {
        const response = await fetch('/Landing/Hero/Hero.html', { cache: 'no-cache' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const heroHtml = await response.text();
        placeholders.forEach((placeholder) => {
            placeholder.innerHTML = heroHtml;
        });
    } catch (error) {
        console.error('Failed to load IntelliTest hero:', error);
    }
});