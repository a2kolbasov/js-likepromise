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
     * @type {?LikePromise}
     */
    #prevPromise = null

    /**
     * @param {?LikePromise} prevPromise
     */
    #setPrevPromise(prevPromise) {
        if (!this.#prevPromise) this.#prevPromise = prevPromise
        else this.#prevPromise.#setPrevPromise(prevPromise)
    }

    #getPrevValue() {
        if (!this.#prevPromise) return null
        return this.#prevPromise.#status === "resolved" ?
            this.#prevPromise.#value :
            this.#prevPromise.#getPrevValue()
    }

    #getPrevError() {
        if (!this.#prevPromise) return null
        return this.#prevPromise.#status === "rejected" ?
            this.#prevPromise.#error :
            this.#prevPromise.#getPrevError()
    }

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
        let resolve = (value) => {
            if (this.#status !== "pending") return

            if (value instanceof LikePromise) {
                value.then(resolve, reject)
            }
            else {
                this.#value = value
                this.#status = "resolved"

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
        }

        let reject = (error) => {
            if (this.#status !== "pending") return

            if (error instanceof LikePromise) {
                error.then(resolve, reject)
            }
            else {
                this.#error = error
                this.#status = "rejected"

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
        }

        executor(resolve, reject)
    }

    static resolve(value) {
        return new LikePromise((resolve, reject) => resolve(value))
    }

    static reject(error) {
        return new LikePromise((resolve, reject) => reject(error))
    }

    #emptyPromise() {
        let promise = LikePromise.resolve()
        promise.#value = this.#value
        promise.#error = this.#error
        return promise
    }

    /**
     * @param {?Callback=} onResolve
     * @param {?Callback=} onReject
     * @returns {LikePromise}
     */
    then(onResolve, onReject) {
        let nextPromise = (typeof onResolve !== "function") ?
            this.#emptyPromise() :
            new LikePromise((resolve, reject) => {
                this.#then({ resolve, reject, lambda: onResolve })
            })
        nextPromise.#setPrevPromise(this)
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
                    resolve(lambda(this.#value))
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
        let nextPromise = (typeof onReject !== "function") ?
            this.#emptyPromise() :
            new LikePromise((resolve, reject) => {
                this.#catch({ resolve, reject, lambda: onReject })
            })
        nextPromise.#setPrevPromise(this)
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
                resolve(this.#getPrevValue())
                break
            }
            case "rejected": {
                try {
                    resolve(lambda(this.#error))
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
        let nextPromise = (typeof onFinally !== "function") ?
            this.#emptyPromise() :
            new LikePromise((resolve, reject) => {
                this.#finally({ resolve, reject, lambda: onFinally })
            })
        nextPromise.#setPrevPromise(this)
        return nextPromise
    }

    /**
     * @param {Next} next
     */
    #finally({ resolve, reject, lambda }) {
        switch (this.#status) {
            case "pending": {
                this.#onFinally.push({ resolve, reject, lambda })
                break
            }
            case "resolved":
            case "rejected": {
                try {
                    lambda()
                    if (this.#prevPromise.#status === "resolved") resolve(this.#prevPromise.#value)
                    else reject(this.#prevPromise.#error)
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
}
