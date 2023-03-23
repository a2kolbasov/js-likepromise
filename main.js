/*
 * Copyright © 2023 Aleksandr Kolbasov
 */

"use strict";

class LikePromise {
    /** @type {"pending" | "resolved" | "rejected"} */
    #status = "pending"

    #value = null
    #error = null

    /**
     * @typedef {{resolve: Callback, reject: Callback, lambda?: (value) => any}} Next
     */

    /**
     * @type {Next[]}
     */
    #onResolve = []
    /**
     * @type {Next[]}
     */
    #onReject = []
    /**
     * @type {Next[]}
     */
    #onFinally = []

    /**
     * @callback Callback
     * @param value
     * @returns {void}
     */

    /**
     * @param {(resolve: Callback, reject: Callback) => void} executor
     */
    constructor(executor) {
        let callSubscribers = () => {
            this.#onResolve.forEach(next => {
                this.#then(next)
            })
            // this.#onResolve = []

            this.#onReject.forEach(next => {
                this.#catch(next)
            })
            // this.#onReject = []

            this.#onFinally.forEach(next => {
                this.#finally(next)
            })
            // this.#onFinally = []
        }

        let resolve = (value) => {
            if (this.#status !== "pending") return

            if (value instanceof LikePromise) {
                value.then(resolve, reject)
            }
            else {
                this.#value = value
                this.#status = "resolved"
                callSubscribers()
            }
        }

        let reject = (error) => {
            if (this.#status !== "pending") return

            if (error instanceof LikePromise) {
                error.then(resolve, reject)
            }
            else {
                this.#error = error
                this.#status = "rejected"
                callSubscribers()
            }
        }

        executor(resolve, reject)
    }

    static resolve(value) {
        return new LikePromise((resolve, reject) => resolve(value))
    }

    static reject(error) {
        return new LikePromise((resolve, reject) => reject(error))
    }

    /**
     * @param {?Callback=} onResolve
     * @param {?Callback=} onReject
     * @returns {LikePromise}
     */
    then(onResolve, onReject) {
        let nextPromise = new LikePromise((resolve, reject) => {
            this.#then({ resolve, reject, lambda: onResolve })
        })
        return (typeof onReject === "function") ? nextPromise.catch(onReject) : nextPromise
    }

    /**
     * @param {Next} next
     */
    #then({ resolve, reject, lambda }) {
        switch (this.#status) {
            case "pending": {
                this.#onResolve.push({ resolve, reject, lambda })
                break
            }
            case "resolved": {
                try {
                    if (typeof lambda !== "function") resolve(this.#value)
                    else resolve(lambda(this.#value))
                } catch (e) {
                    reject(e)
                }
                break
            }
            case "rejected": {
                reject(this.#error)
                break
            }
            default:
                throw TypeError("Unknown status")
        }
    }

    /**
     * @param {?Callback=} onReject
     * @returns {LikePromise}
     */
    catch(onReject) {
        let nextPromise = new LikePromise((resolve, reject) => {
            this.#catch({ resolve, reject, lambda: onReject })
        })
        return nextPromise
    }

    /**
     * @param {Next} next
     */
    #catch({ resolve, reject, lambda }) {
        switch (this.#status) {
            case "pending": {
                this.#onReject.push({ resolve, reject, lambda })
                break
            }
            case "resolved": {
                resolve(this.#value)
                break
            }
            case "rejected": {
                try {
                    if (typeof lambda !== "function") resolve(this.#error)
                    else resolve(lambda(this.#error))
                } catch (e) {
                    reject(e)
                }
                break
            }
            default:
                throw TypeError("Unknown status")
        }
    }

    /**
     * @param {?(() => any)=} onFinally
     * @returns {LikePromise}
     */
    finally(onFinally) {
        let nextPromise = new LikePromise((resolve, reject) => {
            this.#finally({ resolve, reject, lambda: onFinally })
        })
        return nextPromise
    }

    /**
     * @param {Next} next
     */
    #finally({ resolve, reject, lambda }) {
        if (this.#status === "pending") {
            this.#onFinally.push({ resolve, reject, lambda })
            return
        }

        try {
            if (typeof lambda === "function") lambda()
        } catch (e) {
            reject(e)
            return
        }
        if (this.#status === "resolved") resolve(this.#value)
        else if (this.#status === "rejected") reject(this.#error)
        else throw TypeError("Unknown status")
    }
}
