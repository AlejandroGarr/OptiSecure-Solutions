/**
 * Publish/subscribe via native DOM CustomEvents on document.
 * This is the most reliable cross-component communication in Experience Cloud
 * because it avoids module-instance and Locker Service isolation issues.
 */

const _PREFIX = 'lwcpubsub__';

/**
 * Subscribe to an event.
 * @param {string} eventName
 * @param {Function} callback
 * @param {Object} thisArg - the component instance
 */
const subscribe = (eventName, callback, thisArg) => {
    const handler = (e) => {
        callback.call(thisArg, e.detail);
    };
    // Store the handler on the component so we can remove it later
    if (!thisArg.__pubsub_handlers__) {
        thisArg.__pubsub_handlers__ = {};
    }
    thisArg.__pubsub_handlers__[eventName] = handler;
    document.addEventListener(_PREFIX + eventName, handler);
};

/**
 * Unsubscribe from an event.
 * @param {string} eventName
 * @param {Object} thisArg - the component instance that subscribed
 */
const unsubscribe = (eventName, thisArg) => {
    if (thisArg.__pubsub_handlers__ && thisArg.__pubsub_handlers__[eventName]) {
        document.removeEventListener(_PREFIX + eventName, thisArg.__pubsub_handlers__[eventName]);
        delete thisArg.__pubsub_handlers__[eventName];
    }
};

/**
 * Publish an event.
 * @param {string} eventName
 * @param {*} payload
 */
const publish = (eventName, payload) => {
    document.dispatchEvent(
        new CustomEvent(_PREFIX + eventName, { detail: payload })
    );
};

export { subscribe, unsubscribe, publish };
