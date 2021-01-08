
import React, { Component, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Circle } from 'react-konva';
import useImage from 'use-image';
import test from '../../assets/test.jpg';
import { Image } from 'react-konva';

function Store(props) {

    let POVX = 1000;
    let POVY = 1000;

    let stageRef = useRef();

    const [image] = useImage(test);

    let [arr, setArr] = useState([<Image key="pik" x={10} y={10} image={image}></Image>]);

    let loadNewImgs = (x, y) => {
        let newImgs = [];
        for (let i = x - POVX; i < x + POVX; i += 128) {
            let xindex = Math.floor(i / 128);
            let yindex = Math.floor(y);
            let imgx = xindex * 128;
            let imgy = yindex * 128;
            newImgs.push(
                <Image key={"x:" + xindex.toString() + "y:" + yindex.toString()} x={imgx} y={imgy} image={image}></Image>
            )
        }

        setArr([...arr, <Image key="pik" image={image}></Image>]);
        console.log(arr);
    }

    useEffect(() => {
        console.log(stageRef);
        stageRef.current.on('mouseup touchend', (e) => {
            let x = e.currentTarget.attrs.x;
            let y = e.currentTarget.attrs.y;
            console.log("x:", x, "y:", y);
            loadNewImgs(x, y);
        });
    }, [])

    console.log(arr);
    return (
        <div>
            <Stage ref={stageRef} draggable={true} width={window.innerWidth} height={window.innerHeight}>
                <Layer >
                    {arr.map((x) => {
                        const [image] = useImage(test);
                        return x;
                    })}
                </Layer>
            </Stage>
        </div>)
}

export default Store;