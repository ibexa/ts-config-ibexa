declare global {
    interface Window {
        bootstrap: typeof import('bootstrap');
        Chart: typeof import('chart.js');
        ChartDataLabels: typeof import('chartjs-plugin-datalabels');
        flatpickr: typeof import('flatpickr');
        ibexa: any;
        ibexaCart: any;
        L: typeof import('leaflet');
        moment: typeof import('moment');
        Popper: typeof import('@popperjs/core');
        ReactDOMClient: typeof import('react-dom/client');
        Routing: any;
        Translator: any;
    }
}

export {}
