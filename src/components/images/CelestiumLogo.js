import React from "react";

export default function CelestiumLogo(props) {
  let color = "white";
  if (props.color) {
    color = props.color;
  }
  let style = {
    verticalAlign: "text-top",
    display: "inline-block",
    margin: props.margin,
  };
  if (props.hidden) {
    return "";
  }
  return (
    <svg
      version="1.1"
      id="Layer_1"
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      viewBox="80 20 340 500"
      height={props.lineHeight}
      style={style}
    >
      <polygon
        style={{
          stroke: color,
          fill: color,
          strokeMiterlimit: "10",
        }}
        points="410.81,257.59 380.72,267.49 370.82,297.58 360.92,267.49 330.83,257.59 360.92,247.69 370.82,217.61 
           380.72,247.69 "
      />
      <path
        style={{
          stroke: color,
          fill: color,
          strokeMiterlimit: "10",
        }}
        d="M250.39,372.76c-5.71,0-11.32-0.43-16.8-1.25V153.42c5.48-0.82,11.09-1.25,16.8-1.25
           c37,0,69.76,18.04,89.89,45.78l42.01-19.44c-27.75-45.46-77.83-75.8-135.01-75.8c-4.61,0-9.17,0.2-13.68,0.6V73.54h-26.82v34.41
           c-6.38,1.68-12.6,3.75-18.64,6.19v-40.6h-26.82v54.56c-43.41,28.18-72.13,77.09-72.13,132.7c0,55.61,28.71,104.52,72.13,132.7v54.56
           h26.82v-40.6c6.04,2.45,12.27,4.51,18.64,6.19v34.41h26.82V418.3c4.51,0.4,9.07,0.6,13.68,0.6c57.18,0,107.26-30.34,135.01-75.8
           l-40.25-18.63C322.1,353.62,288.49,372.76,250.39,372.76z M139.58,262.47c0-24.59,8.07-47.27,21.74-65.6v131.2
           C147.65,309.74,139.58,287.05,139.58,262.47z M188.13,353.72v-182.5c5.84-3.94,12.07-7.37,18.64-10.15v202.81
           C200.2,361.09,193.98,357.66,188.13,353.72z"
      />
    </svg>
  );
}
