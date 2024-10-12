function blobToImage(blob) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob)
        let img = new Image()
        img.onload = () => {
            if (img.width === 0) {
                console.error('Image has no width');
                throw new Error('Image has no width')
            }
            URL.revokeObjectURL(url)
            resolve(img)
        }
        img.src = url
    })
}

async function svgToPng(svg) {
    return new Promise((resolve) => {
        const url = getSvgUrl(svg);
        svgUrlToPng(url).then((imgData) => {
            resolve(imgData);
            URL.revokeObjectURL(url);
        });
    })
}

function getSvgUrl(svg) {
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

function svgUrlToPng(svgUrl) {
    return new Promise((resolve) => {
        const svgImage = document.createElement('img');
        document.body.appendChild(svgImage);
        svgImage.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.style.display = 'none';
            canvas.width = svgImage.clientWidth;
            canvas.height = svgImage.clientHeight;
            const canvasCtx = canvas.getContext('2d');
            canvasCtx.drawImage(svgImage, 0, 0);
            const imgData = canvas.toDataURL('image/png');
            svgImage.remove();
            resolve(imgData);
        };
        svgImage.src = svgUrl;
    })
}

export { blobToImage, svgToPng }