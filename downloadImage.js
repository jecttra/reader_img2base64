
const parse = require('node-html-parser').parse
const http = require('http');
const { rootCertificates } = require('tls');
const Stream = require('stream').Transform
var Rx = require('rxjs');
var RxOps = require('rxjs/operators');
const { readFileSync, fstat, writeFileSync } = require('fs');
const { glob } = require('glob');
var path = require('path');


function imageUrlToBase64(url) {
    return Rx.Observable.create(function (observer) {
        http.get(url, (response) => {
            var data = new Stream();

            response.on('data', function (chunk) {
                data.push(chunk);
            });
            response.on('end', function () {
                observer.next("data:" + response.headers["content-type"] + ";base64," + Buffer.from(data.read()).toString('base64'));
                observer.complete();
            });
        })
    });

}

function convertHTML(html) {
    const parsedHTML = parse(html);
    return Rx.forkJoin(parsedHTML.querySelectorAll('img').map(img => {

        const url = img.getAttribute('data-lazysrc');
        if (!url || !url.startsWith('http')) {
            console.error('strange img: ', img.outerHTML);
            return Rx.of('');
        } else {
            return imageUrlToBase64(url).pipe(RxOps.tap(base64Url => {
                img.setAttribute('src', base64Url);
                img.setAttribute('style', 'width:100%')
            }))

        }

    })).pipe(RxOps.map(() => parsedHTML.toString()));

}

function processFile(fileName) {
    const content = readFileSync(fileName);
    try {
        const obj = JSON.parse(content);
        if (obj['image_count'] && obj['content']) {
            const htmlText = obj['content']
            convertHTML(htmlText).subscribe((x) => {
                obj['content'] = x;

                writeFileSync(fileName, JSON.stringify(obj));
                console.log('DONE ', fileName);

            })
        } else {
            console.log('SKIPPED ', fileName);

        }


    } catch (e) {
        console.log('ERROR ', fileName, e);

    }


}

glob(path.join(__dirname, 'input', '**', '*'), { nodir: true }, (x, files) => {
    console.log(files);
    files.forEach((x) => processFile(x))


})