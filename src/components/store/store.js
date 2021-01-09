
import React, { Component, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Circle } from 'react-konva';
import useImage from 'use-image';
import test from '../../assets/test.jpg';
import { Image } from 'react-konva';

function Store(props) {

    let POVX = window.screen.width*1.5;
    let POVY = window.screen.height*1.5;

    let stageRef = useRef();

    let [state, setState] = useState({ objThing: { 'key1': [0, 0] } });

    let im = useImage(test)[0];
    let update = true;

    let loadNewImgs = (x, y) => {
        x -= window.screen.width / 2;
        y -= window.screen.height / 2;
        if (update) {
            let newImgs = state.objThing;

            for (let j = y - POVY; j < y + POVY; j += 128) {
                for (let i = x - POVX; i < x + POVX; i += 128) {
                    let xindex = Math.floor(-i / 128);
                    let yindex = Math.floor(-j / 128);
                    let imgx = xindex * 128;
                    let imgy = yindex * 128;
                    let url = test; //change this
                    let key = "x:" + xindex.toString() + "y:" + yindex.toString();
                    let newThing = [imgx, imgy];
                    if (!newImgs[key]) {
                        newImgs[key] = newThing;
                    }
                }
            }
            setState({ objThing: newImgs });
        }
    }

    useEffect(() => {
        console.log(stageRef);
        stageRef.current.on('mouseup touchend', (e) => {
            let x = e.currentTarget.attrs.x;
            let y = e.currentTarget.attrs.y;
            console.log("x:", x, "y:", y);
            loadNewImgs(x, y);
        });
        loadNewImgs(0, 0);
    }, [])

    return (
        <div>
            <Stage ref={stageRef} draggable={true} width={window.innerWidth} height={window.innerHeight}>
                <Layer >
                    {
                        Object.entries(state.objThing).map((xx) => {
                            let [key, value] = xx;
                            let [x, y] = value;
                            return <Image image={im} x={x} y={y} key={key}></Image>;
                        })
                    }
                </Layer>
            </Stage>
        </div>)
}

export default Store;