
import React, { Component } from "react";
import { Stage, Layer, Image } from "react-konva";

class UrlImage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            image: null,
            url: props.url,
            x: props.x,
            y: props.y
        };
    }


    componentDidMount() {
        const image = new window.Image();
        image.src = this.state.url;
        image.onload = () => {
            // setState will redraw layer
            // because "image" property is changed
            this.setState({
                image: image
            });
        };
    }
    render() {
        return <Image x={this.state.x} y={this.state.y} image={this.state.image} />;
    }
}

export default UrlImage;
