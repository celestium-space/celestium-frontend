
import React, { Component, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Circle, Image } from 'react-konva';
import useImage from 'use-image';
import UrlImage from './img';

function Pixels(props) {

    let stageRef = useRef();


    let POVX = window.screen.width;
    let POVY = window.screen.height;

    let [state, setState] = useState({ lst: [] });

    useEffect(() => {
        console.log(stageRef);
        stageRef.current.on('mouseup touchend', (e) => {
            let x = e.currentTarget.attrs.x;
            let y = e.currentTarget.attrs.y;
            console.log("x:", x, "y:", y);
        });

        let img = create_image(16, 16, [...Array(256).keys()].map(x => [0xff, 0, 0]).flat());
        console.log(img);

    }, [])

    return (
        <div>
            <Stage ref={stageRef} scaleX={1} scaleY={1} draggable={true} width={window.innerWidth} height={window.innerHeight}>
                <Layer >
                    {/* <Image x={0} y={0} image={create_image(16, 16, [...Array(256).keys()].map(x => [0xff, 0, 0]).flat())} /> */}
                </Layer>
            </Stage>
            {/* {
                create_image(16, 16, [...Array(256).keys()].map(x => [0xff, 0, 0]).flat())
            } */}
        </div>)


    function create_image(width, height, data) {
        console.log(data);
        const header_size = 70;

        const image_size = width * height * 4;

        const arr = new Uint8Array(header_size + image_size);
        const view = new DataView(arr.buffer);

        // File Header

        // BM magic number.
        view.setUint16(0, 0x424D, false);
        // File size.
        view.setUint32(2, arr.length, true);
        // Offset to image data.
        view.setUint32(10, header_size, true);

        // BITMAPINFOHEADER

        // Size of BITMAPINFOHEADER
        view.setUint32(14, 40, true);
        // Width
        view.setInt32(18, width, true);
        // Height (signed because negative values flip
        // the image vertically).
        view.setInt32(22, height, true);
        // Number of colour planes (colours stored as
        // separate images; must be 1).
        view.setUint16(26, 1, true);
        // Bits per pixel.
        view.setUint16(28, 32, true);
        // Compression method, 6 = BI_ALPHABITFIELDS
        view.setUint32(30, 6, true);
        // Image size in bytes.
        view.setUint32(34, image_size, true);
        // Horizontal resolution, pixels per metre.
        // This will be unused in this situation.
        view.setInt32(38, 10000, true);
        // Vertical resolution, pixels per metre.
        view.setInt32(42, 10000, true);
        // Number of colours. 0 = all
        view.setUint32(46, 0, true);
        // Number of important colours. 0 = all
        view.setUint32(50, 0, true);

        // Colour table. Because we used BI_ALPHABITFIELDS
        // this specifies the R, G, B and A bitmasks.

        // Red
        view.setUint32(54, 0x000000FF, true);
        // Green
        view.setUint32(58, 0x0000FF00, true);
        // Blue
        view.setUint32(62, 0x00FF0000, true);
        // Alpha
        view.setUint32(66, 0xFF000000, true);

        let i = 0;
        for (let w = 0; w < width; ++w) {
            for (let h = 0; h < height; ++h) {
                const offset = header_size + (h * width + w) * 4;
                arr[offset + 0] = data[i];
                arr[offset + 1] = data[i + 1];
                arr[offset + 2] = data[i + 2];
                arr[offset + 3] = 255;
                i += 3;
            }
        }

        // const blob = new Blob([arr], { type: "image/bmp" });
        // var urlCreator = window.URL || window.webkitURL;
        // var imageUrl = urlCreator.createObjectURL(blob);
        // let img = new window.Image(width, height);
        // img.src = imageUrl;
        var b64encoded = btoa(String.fromCharCode.apply(null, arr));
        // let src = "data:image/png;base64," + b64encoded;
        return b64encoded;
    }
}

export default Pixels;