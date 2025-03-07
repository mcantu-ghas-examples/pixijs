import { AsyncQueue as async } from '../src/base/AsyncQueue'; // testing internal package!

describe('async', () =>
{
    describe('queue', () =>
    {
        it('basics', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const delays = [40, 20, 60, 20];

            // worker1: --1-4
            // worker2: -2---3
            // order of completion: 2,1,4,3

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callback('error', 'arg');
                }, delays.shift());
            }, 2);

            q.push(1, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(1);
                callOrder.push('callback 1');
            });
            q.push(2, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(2);
                callOrder.push('callback 2');
            });
            q.push(3, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(0);
                callOrder.push('callback 3');
            });
            q.push(4, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(0);
                callOrder.push('callback 4');
            });
            expect(q.length()).toEqual(4);
            expect(q.concurrency).toEqual(2);

            q.drain = () =>
            {
                expect(callOrder).toEqual([
                    'process 2', 'callback 2',
                    'process 1', 'callback 1',
                    'process 4', 'callback 4',
                    'process 3', 'callback 3',
                ]);
                expect(q.concurrency).toEqual(2);
                expect(q.length()).toEqual(0);
                done();
            };
        });

        it('default concurrency', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const delays = [40, 20, 60, 20];

            // order of completion: 1,2,3,4

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callback('error', 'arg');
                }, delays.shift());
            });

            q.push(1, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(3);
                callOrder.push('callback 1');
            });
            q.push(2, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(2);
                callOrder.push('callback 2');
            });
            q.push(3, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(1);
                callOrder.push('callback 3');
            });
            q.push(4, (err, arg) =>
            {
                expect(err).toEqual('error');
                expect(arg).toEqual('arg');
                expect(q.length()).toEqual(0);
                callOrder.push('callback 4');
            });
            expect(q.length()).toEqual(4);
            expect(q.concurrency).toEqual(1);

            q.drain = () =>
            {
                expect(callOrder).toEqual([
                    'process 1', 'callback 1',
                    'process 2', 'callback 2',
                    'process 3', 'callback 3',
                    'process 4', 'callback 4',
                ]);
                expect(q.concurrency).toEqual(1);
                expect(q.length()).toEqual(0);
                done();
            };
        });

        it('zero concurrency', (done: () => void) =>
        {
            expect(() =>
            {
                async.queue((task: any, callback: (...args: any) => void): void =>
                {
                    callback(null, task);
                }, 0);
            }).toThrow();
            done();
        });

        it('error propagation', (done: () => void) =>
        {
            const results: Array<string> = [];

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                callback(task.name === 'foo' ? new Error('fooError') : null);
            }, 2);

            q.drain = () =>
            {
                expect(results).toEqual(['bar', 'fooError']);
                done();
            };

            q.push({ name: 'bar' }, (err) =>
            {
                if (err)
                {
                    results.push('barError');

                    return;
                }

                results.push('bar');
            });

            q.push({ name: 'foo' }, (err) =>
            {
                if (err)
                {
                    results.push('fooError');

                    return;
                }

                results.push('foo');
            });
        });

        it('global error handler', (done: () => void) =>
        {
            const results: Array<string> = [];

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                callback(task.name === 'foo' ? new Error('fooError') : null);
            }, 2);

            q.error = (error, task) =>
            {
                expect(error).toBeDefined();
                expect(error.message).toEqual('fooError');
                expect(task.name).toEqual('foo');
                results.push('fooError');
            };

            q.drain = () =>
            {
                expect(results).toEqual(['fooError', 'bar']);
                done();
            };

            q.push({ name: 'foo' });

            q.push({ name: 'bar' }, (err) =>
            {
                expect(err).toBeFalsy();
                results.push('bar');
            });
        });

        // The original queue implementation allowed the concurrency to be changed only
        // on the same event loop during which a task was added to the queue. This
        // test attempts to be a more robust test.
        // Start with a concurrency of 1. Wait until a leter event loop and change
        // the concurrency to 2. Wait again for a later loop then verify the concurrency
        // Repeat that one more time by chaning the concurrency to 5.
        it('changing concurrency', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callback();
                }, 10);
            }, 1);

            for (let i = 0; i < 50; ++i)
            {
                q.push('');
            }

            q.drain = () =>
            {
                done();
            };

            setTimeout(() =>
            {
                expect(q.concurrency).toEqual(1);
                q.concurrency = 2;
                setTimeout(() =>
                {
                    expect(q.running()).toEqual(2);
                    q.concurrency = 5;
                    setTimeout(() =>
                    {
                        expect(q.running()).toEqual(5);
                    }, 40);
                }, 40);
            }, 40);
        });

        it('push without callback', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const delays = [40, 20, 60, 20];

            // worker1: --1-4
            // worker2: -2---3
            // order of completion: 2,1,4,3

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callback('error', 'arg');
                }, delays.shift());
            }, 2);

            q.push(1);
            q.push(2);
            q.push(3);
            q.push(4);

            q.drain = () =>
            {
                expect(callOrder).toEqual([
                    'process 2',
                    'process 1',
                    'process 4',
                    'process 3',
                ]);
                done();
            };
        });

        it('push with non-function', (done: () => void) =>
        {
            const q = async.queue(() => { /* empty */ }, 1);

            expect(() =>
            {
                // @ts-expect-error - testing for error
                q.push({}, 1);
            }).toThrow();
            done();
        });

        it('unshift', (done: () => void) =>
        {
            const queueOrder: Array<number> = [];

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                queueOrder.push(task);
                callback();
            }, 1);

            q.unshift(4);
            q.unshift(3);
            q.unshift(2);
            q.unshift(1);

            setTimeout(() =>
            {
                expect(queueOrder).toEqual([1, 2, 3, 4]);
                done();
            }, 100);
        });

        it('too many callbacks', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                callback();
                expect(() =>
                {
                    callback();
                }).toThrow();
                done();
            }, 2);

            q.push(1);
        });

        it('idle', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                // Queue is busy when workers are running
                expect(q.idle()).toEqual(false);
                callback();
            }, 1);

            // Queue is idle before anything added
            expect(q.idle()).toEqual(true);

            q.unshift(4);
            q.unshift(3);
            q.unshift(2);
            q.unshift(1);

            // Queue is busy when tasks added
            expect(q.idle()).toEqual(false);

            q.drain = () =>
            {
                // Queue is idle after drain
                expect(q.idle()).toEqual(true);
                done();
            };
        });

        it.skip('pause', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const taskTimeout = 80;
            const pauseTimeout = taskTimeout * 2.5;
            const resumeTimeout = taskTimeout * 4.5;
            const tasks = [1, 2, 3, 4, 5, 6];

            const elapsed = (() =>
            {
                const start = Date.now();

                return () => Math.round((Date.now() - start) / taskTimeout) * taskTimeout;
            })();

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                callOrder.push(`process ${task}`);
                callOrder.push(`timeout ${elapsed()}`);
                callback();
            });

            function pushTask()
            {
                const task = tasks.shift();

                if (!task)
                {
                    return;
                }

                setTimeout(() =>
                {
                    q.push(task);
                    pushTask();
                }, taskTimeout);
            }
            pushTask();

            setTimeout(() =>
            {
                q.pause();
                expect(q.paused).toEqual(true);
            }, pauseTimeout);

            setTimeout(() =>
            {
                q.resume();
                expect(q.paused).toEqual(false);
            }, resumeTimeout);

            setTimeout(() =>
            {
                expect(callOrder).toEqual([
                    'process 1', `timeout ${taskTimeout}`,
                    'process 2', `timeout ${(taskTimeout * 2)}`,
                    'process 3', `timeout ${(taskTimeout * 5)}`,
                    'process 4', `timeout ${(taskTimeout * 5)}`,
                    'process 5', `timeout ${(taskTimeout * 5)}`,
                    'process 6', `timeout ${(taskTimeout * 6)}`,
                ]);
                done();
            }, (taskTimeout * tasks.length) + pauseTimeout + resumeTimeout);
        });

        it('pause in worker with concurrency', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                if (task.isLongRunning)
                {
                    q.pause();
                    setTimeout(() =>
                    {
                        callOrder.push(task.id);
                        q.resume();
                        callback();
                    }, 50);
                }
                else
                {
                    callOrder.push(task.id);
                    setTimeout(callback, 10);
                }
            }, 10);

            q.push({ id: 1, isLongRunning: true });
            q.push({ id: 2 });
            q.push({ id: 3 });
            q.push({ id: 4 });
            q.push({ id: 5 });

            q.drain = () =>
            {
                expect(callOrder).toEqual([1, 2, 3, 4, 5]);
                done();
            };
        });

        it('pause with concurrency', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const taskTimeout = 40;
            const pauseTimeout = taskTimeout / 2;
            const resumeTimeout = taskTimeout * 2.75;
            const tasks = [1, 2, 3, 4, 5, 6];

            const elapsed = (() =>
            {
                const start = Date.now();

                return () => Math.round((Date.now() - start) / taskTimeout) * taskTimeout;
            })();

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callOrder.push(`timeout ${elapsed()}`);
                    callback();
                }, taskTimeout);
            }, 2);

            for (let i = 0; i < tasks.length; ++i)
            {
                q.push(tasks[i]);
            }

            setTimeout(() =>
            {
                q.pause();
                expect(q.paused).toEqual(true);
            }, pauseTimeout);

            setTimeout(() =>
            {
                q.resume();
                expect(q.paused).toEqual(false);
            }, resumeTimeout);

            setTimeout(() =>
            {
                expect(q.running()).toEqual(2);
            }, resumeTimeout + 10);

            setTimeout(() =>
            {
                expect(callOrder).toEqual([
                    'process 1', `timeout ${taskTimeout}`,
                    'process 2', `timeout ${taskTimeout}`,
                    'process 3', `timeout ${(taskTimeout * 4)}`,
                    'process 4', `timeout ${(taskTimeout * 4)}`,
                    'process 5', `timeout ${(taskTimeout * 5)}`,
                    'process 6', `timeout ${(taskTimeout * 5)}`,
                ]);
                done();
            }, (taskTimeout * tasks.length) + pauseTimeout + resumeTimeout);
        });

        it('start paused', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callback();
                }, 40);
            }, 2);

            q.pause();

            q.push(1);
            q.push(2);
            q.push(3);

            setTimeout(() =>
            {
                q.resume();
            }, 5);

            setTimeout(() =>
            {
                expect(q._tasks.length).toEqual(1);
                expect(q.running()).toEqual(2);
                q.resume();
            }, 15);

            q.drain = () =>
            {
                done();
            };
        });

        it('kill', (done: () => void) =>
        {
            const q = async.queue((/* task, callback */) =>
            {
                setTimeout(() =>
                {
                    throw new Error('Function should never be called');
                }, 20);
            }, 1);

            q.drain = () =>
            {
                throw new Error('Function should never be called');
            };

            q.push(0);

            q.kill();

            setTimeout(() =>
            {
                expect(q.length()).toEqual(0);
                done();
            }, 40);
        });

        it('events', (done: () => void) =>
        {
            const calls: Array<string> = [];
            const q = async.queue((task, cb) =>
            {
                // nop
                calls.push(`process ${task}`);
                setTimeout(cb, 10);
            }, 3);

            q.concurrency = 3;

            q.saturated = () =>
            {
                expect(q.running()).toEqual(3);
                calls.push('saturated');
            };
            q.empty = () =>
            {
                expect(q.length()).toEqual(0);
                calls.push('empty');
            };
            q.drain = () =>
            {
                expect(q.length() === 0 && q.running() === 0)
                    .toEqual(true);
                calls.push('drain');
                expect(calls).toEqual([
                    'process foo',
                    'process bar',
                    'saturated',
                    'process zoo',
                    'foo cb',
                    'saturated',
                    'process poo',
                    'bar cb',
                    'empty',
                    'saturated',
                    'process moo',
                    'zoo cb',
                    'poo cb',
                    'moo cb',
                    'drain',
                ]);
                done();
            };
            q.push('foo', () => calls.push('foo cb'));
            q.push('bar', () => calls.push('bar cb'));
            q.push('zoo', () => calls.push('zoo cb'));
            q.push('poo', () => calls.push('poo cb'));
            q.push('moo', () => calls.push('moo cb'));
        });

        it('empty', (done: () => void) =>
        {
            const calls: Array<string> = [];
            const q = async.queue((task, cb) =>
            {
                // nop
                calls.push(`process ${task}`);
                setTimeout(cb, 1);
            }, 3);

            q.drain = () =>
            {
                expect(q.length() === 0 && q.running() === 0)
                    .toEqual(true);
                calls.push('drain');
                expect(calls).toEqual([
                    'drain',
                ]);
                done();
            };
            q.push(undefined);
        });

        it('saturated', (done: () => void) =>
        {
            let saturatedCalled = false;
            const q = async.queue((_task, cb) =>
            {
                setTimeout(cb, 1);
            }, 2);

            q.saturated = () =>
            {
                saturatedCalled = true;
            };
            q.drain = () =>
            {
                expect(saturatedCalled).toEqual(true);
                done();
            };

            q.push('foo');
            q.push('bar');
            q.push('baz');
            q.push('moo');
        });

        it('started', (done: () => void) =>
        {
            const q = async.queue((task, cb) =>
            {
                cb(null, task);
            });

            expect(q.started).toEqual(false);
            q.push(undefined);
            expect(q.started).toEqual(true);
            done();
        });

        describe('q.saturated(): ', () =>
        {
            it('should call the saturated callback if tasks length is concurrency', (done: () => void) =>
            {
                const calls: Array<string> = [];
                const q = async.queue((task, cb) =>
                {
                    calls.push(`process ${task}`);
                    setTimeout(cb, 1);
                }, 4);

                q.saturated = () =>
                {
                    calls.push('saturated');
                };
                q.empty = () =>
                {
                    expect(calls.indexOf('saturated')).toBeGreaterThan(-1);
                    setTimeout(() =>
                    {
                        expect(calls).toEqual([
                            'process foo0',
                            'process foo1',
                            'process foo2',
                            'saturated',
                            'process foo3',
                            'foo0 cb',
                            'saturated',
                            'process foo4',
                            'foo1 cb',
                            'foo2 cb',
                            'foo3 cb',
                            'foo4 cb',
                        ]);
                        done();
                    }, 50);
                };
                q.push('foo0', () => calls.push('foo0 cb'));
                q.push('foo1', () => calls.push('foo1 cb'));
                q.push('foo2', () => calls.push('foo2 cb'));
                q.push('foo3', () => calls.push('foo3 cb'));
                q.push('foo4', () => calls.push('foo4 cb'));
            });
        });

        describe('q.unsaturated(): ', () =>
        {
            it('should have a default buffer property that equals 25% of the concurrenct rate', (done: () => void) =>
            {
                const calls: Array<string> = [];
                const q = async.queue((task, cb) =>
                {
                    // nop
                    calls.push(`process ${task}`);
                    setTimeout(cb, 1);
                }, 10);

                expect(q.buffer).toEqual(2.5);
                done();
            });
            it('should allow a user to change the buffer property', (done: () => void) =>
            {
                const calls: Array<string> = [];
                const q = async.queue((task, cb) =>
                {
                    // nop
                    calls.push(`process ${task}`);
                    setTimeout(cb, 1);
                }, 10);

                q.buffer = 4;
                expect(q.buffer).not.toEqual(2.5);
                expect(q.buffer).toEqual(4);
                done();
            });
            it('should call the unsaturated callback if tasks length is less than concurrency minus buffer',
                (done: () => void) =>
                { // eslint-disable-line max-len
                    const calls: Array<string> = [];
                    const q = async.queue((task: any, cb: () => void) =>
                    {
                        calls.push(`process ${task}`);
                        setTimeout(cb, 1);
                    }, 4);

                    q.unsaturated = () =>
                    {
                        calls.push('unsaturated');
                    };
                    q.empty = () =>
                    {
                        expect(calls.indexOf('unsaturated')).toBeGreaterThan(-1);
                        setTimeout(() =>
                        {
                            expect(calls).toEqual([
                                'process foo0',
                                'process foo1',
                                'process foo2',
                                'process foo3',
                                'foo0 cb',
                                'unsaturated',
                                'process foo4',
                                'foo1 cb',
                                'unsaturated',
                                'foo2 cb',
                                'unsaturated',
                                'foo3 cb',
                                'unsaturated',
                                'foo4 cb',
                                'unsaturated',
                            ]);
                            done();
                        }, 50);
                    };
                    q.push('foo0', () => calls.push('foo0 cb'));
                    q.push('foo1', () => calls.push('foo1 cb'));
                    q.push('foo2', () => calls.push('foo2 cb'));
                    q.push('foo3', () => calls.push('foo3 cb'));
                    q.push('foo4', () => calls.push('foo4 cb'));
                });
        });
    });

    describe('eachSeries', () =>
    {
        function eachIteratee(args: Array<any>, x: number, callback: () => void)
        {
            setTimeout(() =>
            {
                args.push(x);
                callback();
            }, x * 25);
        }

        function eachNoCallbackIteratee(done: () => void, x: number, callback: () => void)
        {
            expect(x).toEqual(1);
            callback();
            done();
        }

        it('eachSeries', (done: () => void) =>
        {
            const args: Array<number> = [];

            async.eachSeries([1, 3, 2], eachIteratee.bind({ }, args), (err) =>
            {
                expect(err).toEqual(undefined);
                expect(args).toEqual([1, 3, 2]);
                done();
            });
        });

        it('empty array', (done: () => void) =>
        {
            async.eachSeries([], (_x: number, callback: () => void) =>
            {
                expect(false).toEqual(true);
                callback();
            }, (err) =>
            {
                if (err)
                {
                    throw err;
                }

                expect(true).toEqual(true);
            });
            setTimeout(done, 25);
        });

        it('array modification', (done: () => void) =>
        {
            const arr = [1, 2, 3, 4];

            async.eachSeries(arr, (_x, callback) =>
            {
                setTimeout(callback, 1);
            }, () =>
            {
                expect(true).toEqual(true);
            });

            arr.pop();
            arr.splice(0, 1);

            setTimeout(done, 50);
        });

        // bug #782.  Remove in next major release
        it('single item', (done: () => void) =>
        {
            let sync = true;

            async.eachSeries(
                [1],
                (_i, cb) =>
                {
                    cb(null);
                },
                () =>
                {
                    expect(sync).toEqual(true);
                }
            );
            sync = false;
            done();
        });

        // bug #782.  Remove in next major release
        it('single item', (done: () => void) =>
        {
            let sync = true;

            async.eachSeries(
                [1],
                (_i, cb) =>
                {
                    cb(null);
                },
                () =>
                {
                    expect(sync).toEqual(true);
                }
            );
            sync = false;
            done();
        });

        it('error', (done: () => void) =>
        {
            const callOrder: Array<string> = [];

            async.eachSeries(
                [1, 2, 3],
                (x: any, callback: (x: string) => void) =>
                {
                    callOrder.push(x);
                    callback('error');
                },
                (err: string) =>
                {
                    expect(callOrder).toEqual([1]);
                    expect(err).toEqual('error');
                }
            );
            setTimeout(done, 50);
        });

        it('no callback', (done: () => void) =>
        {
            async.eachSeries([1], eachNoCallbackIteratee.bind(this, done));
        });
    });
});
