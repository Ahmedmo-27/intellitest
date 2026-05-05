document.addEventListener('DOMContentLoaded', () => {
	const faqList = document.querySelector('.faq-list');
	if (!faqList) {
		return;
	}

	faqList.addEventListener('click', (event) => {
		const toggle = event.target.closest('.faq-toggle');
		if (!toggle || !faqList.contains(toggle)) {
			return;
		}

		const item = toggle.closest('.faq-item');
		const answerId = toggle.getAttribute('aria-controls');
		if (!item || !answerId) {
			return;
		}

		const answer = document.getElementById(answerId);
		if (!answer) {
			return;
		}

		const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
		toggle.setAttribute('aria-expanded', String(!isExpanded));
		answer.hidden = isExpanded;
		item.classList.toggle('is-open', !isExpanded);
	});
});
