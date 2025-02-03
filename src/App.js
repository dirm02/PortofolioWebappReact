import React, { Component } from "react";
import $ from "jquery";
import "./App.scss";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Portfolio from "./pages/Portfolio";
import Products from "./pages/Products";
import Services from "./pages/Services";

// Define language variables globally
window.$primaryLanguage = 'en';
window.$secondaryLanguage = 'fr';
window.$primaryLanguageIconId = 'primary-lang-icon';
window.$secondaryLanguageIconId = 'secondary-lang-icon';

// Backend URL configuration
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resumeData: {},
      sharedData: {},
      peepBasterds: 0
    };
    this.hasIncrementedView = false;
  }

  applyPickedLanguage = (pickedLanguage, oppositeLangIconId) => {
    this.swapCurrentlyActiveLanguage(oppositeLangIconId);
    document.documentElement.lang = pickedLanguage;
    const resumePath =
      document.documentElement.lang === window.$primaryLanguage
        ? `res_primaryLanguage.json`
        : `res_secondaryLanguage.json`;
    this.loadResumeFromPath(resumePath);
  };

  swapCurrentlyActiveLanguage = (oppositeLangIconId) => {
    const pickedLangIconId =
      oppositeLangIconId === window.$primaryLanguageIconId
        ? window.$secondaryLanguageIconId
        : window.$primaryLanguageIconId;

    const oppositeElem = document.getElementById(oppositeLangIconId);
    const pickedElem = document.getElementById(pickedLangIconId);

    // Dim the OPPOSITE language flag (the one not selected)
    if (oppositeElem) {
      oppositeElem.setAttribute("filter", "brightness(40%)");
    }
    // Clear the SELECTED language flag
    if (pickedElem) {
      pickedElem.removeAttribute("filter");
    }
  };

  componentDidMount() {
    this.loadSharedData();
    // Add null check for DOM element
    const secondaryLangElem = document.getElementById(window.$secondaryLanguageIconId);
    if (secondaryLangElem) {
      secondaryLangElem.setAttribute("filter", "brightness(40%)");
    }
    this.applyPickedLanguage(
      window.$primaryLanguage,
      window.$secondaryLanguageIconId
    );
    if (!this.hasIncrementedView) {
      this.incrementViewCount();
      this.hasIncrementedView = true;
    }
  }

  componentWillUnmount() {
    if (this.viewCountInterval) {
      clearInterval(this.viewCountInterval);
    }
  }

  incrementViewCount = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/views`, {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      this.setState({ peepBasterds: data.views });
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  loadResumeFromPath(path) {
    $.ajax({
      url: `/${path}`,
      dataType: "json",
      cache: false,
      success: (data) => {
        this.setState({ resumeData: data });
      },
      error: (xhr, status, err) => {
        console.error("Failed to load resume data:", err);
        alert("Failed to load resume data");
      },
    });
  }

  loadSharedData() {
    $.ajax({
      url: `/portfolio_shared_data.json`,
      dataType: "json",
      cache: false,
      success: (data) => {
        this.setState({ sharedData: data }, () => {
          document.title = this.state.sharedData.basic_info?.name || "Portfolio";
        });
      },
      error: (xhr, status, err) => {
        console.error("Failed to load shared data:", err);
        alert("Failed to load shared data");
      },
    });
  }

  render() {
    const { peepBasterds } = this.state;
    return (
      <Router>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/services" element={<Services />} />
            <Route
              path="/portfolio"
              element={
                <Portfolio
                  applyPickedLanguage={this.applyPickedLanguage}
                  sharedData={this.state.sharedData}
                  sharedBasicInfo={this.state.sharedData.basic_info}
                  resumeBasicInfo={this.state.resumeData.basic_info}
                  resumeProjects={this.state.resumeData.projects}
                  resumeExperience={this.state.resumeData.experience}
                  sharedSkills={this.state.sharedData.skills}
                  peepBasterds={peepBasterds}
                />
              }
            />
            
          </Routes>
        </main>
      </Router>
    );
  }
}

export default App;
