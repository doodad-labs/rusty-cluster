/**
 * @typedef {Object} InViewOptions
 * @property {number} [threshold=0.1] - % of element visibility required
 * @property {boolean} [once=false] - Trigger only once
 * @property {boolean} [trackExit=false] - Enable exit callbacks
 */

/**
 * @param {HTMLElement} node
 * @param {InViewOptions} [options]
 */
export default function inViewAction(node, options = {}) {
    const { threshold = 0.1, once = false, trackExit = false } = options;
    let observer;

    const handleIntersect = (entries) => {
        const [entry] = entries;

        if (entry.isIntersecting) {
            node.dispatchEvent(new CustomEvent('enterView'));
            if (once) observer?.unobserve(node);
        }
        else if (trackExit) {
            node.dispatchEvent(new CustomEvent('exitView'));
        }
    };

    observer = new IntersectionObserver(handleIntersect, { threshold });
    observer.observe(node);

    return {
        update(newOptions) {
            observer?.unobserve(node);
            ({ threshold = 0.1, once = false, trackExit = false } = newOptions);
            observer = new IntersectionObserver(handleIntersect, { threshold });
            observer.observe(node);
        },
        destroy() {
            observer?.unobserve(node);
        }
    };
}