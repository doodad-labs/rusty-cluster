import type { ActionReturn } from 'svelte/action';

type InViewOptions = {
    threshold?: number;
    once?: boolean;
    trackExit?: boolean;
};

type InViewAttributes = {
    'onenterView'?: (e: CustomEvent<void>) => void;
    'onexitView'?: (e: CustomEvent<void>) => void;
};

export default function inViewAction(
    node: HTMLElement,
    options: InViewOptions = {}
): ActionReturn<InViewOptions, InViewAttributes> {
    let { threshold = 0.1, once = false, trackExit = false } = options;
    let observer: IntersectionObserver | undefined;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
        const [entry] = entries;

        if (entry.isIntersecting) {
            node.dispatchEvent(new CustomEvent('enterView'));
            if (once) observer?.unobserve(node);
        } else if (trackExit) {
            node.dispatchEvent(new CustomEvent('exitView'));
        }
    };

    observer = new IntersectionObserver(handleIntersect, { threshold });
    observer.observe(node);

    return {
        update(newOptions: InViewOptions) {
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