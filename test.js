p =
    new LikePromise((resolve) => { setTimeout(() => resolve(1)) })
        .then(result => result + 1)
        .then(result => new LikePromise((resolve) => setTimeout(() => resolve(result + 1))))
p1 = p
    .then(result => new LikePromise((resolve, reject) => reject('err_')))
p2 = p1
    .catch(e => e)
p3 = p2
    .finally(() => { console.log('finally') })
p4 = p3
    .then(result => { console.log('result:', result) })
    ;
