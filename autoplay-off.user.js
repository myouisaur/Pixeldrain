// ==UserScript==
// @name         [Pixeldrain] Autoplay Off
// @namespace    https://github.com/myouisaur/Pixeldrain
// @icon         https://pixeldrain.com/res/img/pixeldrain_256.png
// @version      1.1
// @description  Prevents media files from automatically buffering to save bandwidth.
// @author       Xiv
// @match        *://*.pixeldrain.com/*
// @run-at       document-start
// @noframes
// @updateURL    https://myouisaur.github.io/Pixeldrain/autoplay-off.user.js
// @downloadURL  https://myouisaur.github.io/Pixeldrain/autoplay-off.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Guard against duplicate initialization in SPAs
    if (window.__pxBandwidthSaverInitialized) return;
    window.__pxBandwidthSaverInitialized = true;

    // --- CONFIGURATION ---
    const CONFIG = {
        targetTags: ['VIDEO', 'AUDIO'],
        debug: false // Toggle to true to see interception logs in the console
    };

    const log = (message, isError = false) => {
        if (!CONFIG.debug && !isError) return;
        const prefix = '[Pixeldrain Autoplay Off]';
        isError ? console.error(`${prefix} ${message}`) : console.log(`${prefix} ${message}`);
    };

    // --- MODULE: ELEMENT SANITIZER ---
    // Safely forces the element into a non-buffering state before the browser fetches data
    const sanitizeMediaElement = (element) => {
        if (!element || !element.tagName) return;

        const tagName = element.tagName.toUpperCase();
        if (!CONFIG.targetTags.includes(tagName)) return;

        let modified = false;

        // 1. Strip HTML autoplay attribute
        if (element.hasAttribute('autoplay')) {
            element.removeAttribute('autoplay');
            modified = true;
        }

        // 2. Force browser to defer network requests until 'play' is clicked
        if (element.getAttribute('preload') !== 'none') {
            element.setAttribute('preload', 'none');
            modified = true;
        }

        // 3. Override JS-level properties set by UI frameworks
        if (element.autoplay) {
            element.autoplay = false;
            modified = true;
        }

        if (modified) {
            log(`Sanitized <${tagName.toLowerCase()}> element (autoplay removed, preload="none")`);
        }
    };

    // --- MODULE: DOM OBSERVER ---
    // Catches elements hardcoded in HTML or injected via framework renders
    const initObserver = () => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    // Skip text nodes and comments immediately for performance
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // Direct element match
                    if (CONFIG.targetTags.includes(node.tagName.toUpperCase())) {
                        sanitizeMediaElement(node);
                    }

                    // Check descendants if a larger container was injected
                    if (node.firstElementChild) {
                        const mediaElements = node.querySelectorAll('video, audio');
                        if (mediaElements.length > 0) {
                            mediaElements.forEach(sanitizeMediaElement);
                        }
                    }
                }
            }
        });

        // Observe documentElement because body does not exist yet at document-start
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        log('DOM Observer initialized');
    };

    // --- MODULE: API INTERCEPTOR ---
    // Catches elements created natively via JS before they are ever attached to the DOM
    const initAPIInterceptor = () => {
        const originalCreateElement = document.createElement;

        document.createElement = function (tagName, options) {
            const element = originalCreateElement.call(this, tagName, options);

            if (typeof tagName === 'string' && CONFIG.targetTags.includes(tagName.toUpperCase())) {
                log(`Intercepted creation of <${tagName.toLowerCase()}> via JS API`);

                // Use a microtask to sanitize AFTER the caller finishes setting its immediate properties,
                // but BEFORE the browser gets a chance to act on them and fire a network request.
                queueMicrotask(() => sanitizeMediaElement(element));
            }

            return element;
        };

        log('API Interceptor initialized');
    };

    // --- BOOT SEQUENCE ---
    try {
        initAPIInterceptor();
        initObserver();
        log('Successfully initialized boot sequence');
    } catch (error) {
        log(`Initialization failed: ${error.message}`, true);
    }
})();
