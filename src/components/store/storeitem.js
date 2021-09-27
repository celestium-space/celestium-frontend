import React, {
  Component,
  useEffect,
  useRef,
  useState,
  createRef,
} from "react";
import { range, intToRgb } from "../../utils";
import { Divider, Grid, Image, Segment, Card, Icon } from "semantic-ui-react";

class StoreItem extends Component {
  constructor(props) {
    super(props);
    let placeHolder =
      "https://react.semantic-ui.com/images/avatar/large/matthew.png";
    this.state = {
      url: placeHolder,
      description: "lorem somthing here",
      id: props.id,
      price: 10,
    };

    this.onClick = props.onClick;
  }

  componentDidMount() {
    fetch(
      "https://jsonplaceholder.typicode.com/todos/" + this.props.id.toString()
    )
      .then((response) => response.json())
      .then((json) => {
        this.setState({
          description: json.title,
        });
      });
  }

  render() {
    return (
      <Card
        onClick={(x) => {
          if (this.onClick) this.onClick(this.state.id);
        }}
      >
        <Image src={this.state.url} wrapped ui={false} />
        <Card.Content>
          <Card.Header>Cool name</Card.Header>
          <Card.Meta>
            <span>Meteor/Super cool space object</span>
          </Card.Meta>
          <Card.Description>{this.state.description}</Card.Description>
        </Card.Content>
        <Card.Content extra>
          <a>
            <Icon name="bitcoin" />
            {this.state.price} Celestium
          </a>
        </Card.Content>
      </Card>
    );
  }
}

export default StoreItem;
