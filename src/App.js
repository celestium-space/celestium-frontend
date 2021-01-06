import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
import Home from './components/home/home'
import ISSFinder from './components/iss/iss'

function App() {
  return (
    <ISSFinder></ISSFinder>
  );
}


export default App;