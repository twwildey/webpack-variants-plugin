import(/* webpackChunkName: "A" */ './A.js').then(() => {
    import(/* webpackChunkName: "C" */'./C.js').then(() => {
        console.log('dynamic.js');
    });
});
