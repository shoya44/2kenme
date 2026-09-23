import '@testing-library/jest-dom/vitest';

// jsdom は window.scrollTo を実装しておらず、呼ぶたびに console.error を出す
window.scrollTo = () => {};
