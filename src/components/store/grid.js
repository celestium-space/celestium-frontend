import React, { Component, useEffect, useRef, useState, createRef } from 'react'
import { Stage, Layer, Rect, Circle, Image } from 'react-konva';
import useImage from 'use-image';
import UrlImage from './img';


function getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    return [x, y];
}

class Grid extends Component {

    constructor(props) {
        super(props);
        this.canvasRef = createRef();
        this.onClick = props.onClick;

        this.updatePixels = (x, y, width, height, data) => {
            let canvas = this.canvasRef.current;
            let ctx = canvas.getContext('2d');
            let array = new Uint8ClampedArray(data);
            console.log(array);
            let k = new ImageData(array, width, height);
            ctx.putImageData(k, x, y);
        }
    }


    render() {
        return <canvas
            id="canvas"
            ref={this.canvasRef}
            width={1000}
            height={1000}
            onClick={(event) => {
                let canvas = this.canvasRef.current;
                let [x, y] = getCursorPosition(canvas, event);
                let ctx = canvas.getContext('2d');
                let data = ctx.getImageData(x, y, 1, 1).data;
                let rgb = [data[0], data[1], data[2]];
                this.onClick(Math.round(x), Math.round(y), rgb);
            }}
            style={{
                // border: '2px solid #000',
                marginTop: 10,
                marginLeft: 10,
            }}
        ></canvas >;
    }
}

export default Grid;