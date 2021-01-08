import React, { Component } from 'react'
import { Menu } from 'semantic-ui-react';
import { GiMissileMech } from 'react-icons/gi';
import { FaStoreAlt } from 'react-icons/fa';
import { AiFillSetting } from 'react-icons/ai';
import { Divider, Grid, Image, Segment } from 'semantic-ui-react'
import { Link } from 'react-router-dom'

function Navbar(props) {
    return (
        <Menu fixed='bottom' size="large" widths={3}>
            <Menu.Item as={Link} active={props.active == 'iss'} to="/iss">
                <GiMissileMech />
            </Menu.Item>
            <Menu.Item as={Link} active={props.active == 'store'} to="/store">
                <FaStoreAlt />
            </Menu.Item>
            <Menu.Item as={Link} active={props.active == 'setting'} to="/setting">
                <AiFillSetting />
            </Menu.Item>
        </Menu>

    )
}

export default Navbar;