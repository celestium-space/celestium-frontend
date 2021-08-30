import React, { Component, useEffect, useRef, useState, createRef } from 'react';
import { range, intToRgb } from '../../utils';

class Controlls extends Component {

    constructor(props) {
        super(props);
        this.state = { active: 0 };

        let click = (i) => {
            this.setState({ active: i });
        }
        this.click = click;
    }

    render() {
        let click = this.click;
        return <div style={{
            display: 'flex',
        }}>
            {range(8).map(i => <div key={i.toString()} onClick={(_) => click(i)} style={{ border: (this.state.active == i) ? "5px solid gray" : "", width: "100px", height: "100px", backgroundColor: intToRgb(i), margin: "10px" }}></div>)};
        </div>
    }
}

export default Controlls;