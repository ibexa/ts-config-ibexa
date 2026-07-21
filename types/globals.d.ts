import type { Translator } from './translator';

declare global {
    interface Ibexa {
        addConfig(path: string, value: unknown, merge?: boolean): void;
    }

    interface Window {
        bootstrap: typeof import('bootstrap');
        Chart: typeof import('chart.js');
        ChartDataLabels: typeof import('chartjs-plugin-datalabels');
        flatpickr: typeof import('flatpickr');
        ibexa: Ibexa;
        L: typeof import('leaflet');
        moment: typeof import('moment');
        Popper: typeof import('@popperjs/core');
        ReactDOMClient: typeof import('react-dom/client');
        Routing: typeof import('./router').default;
        Translator: Translator;
    }
}

export {}
