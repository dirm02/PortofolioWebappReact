import React, { Component } from "react";
import $ from "jquery";
import "./App.scss";
import Header from "./components/Header";
import Footer from "./components/Footer";
import About from "./components/About";
import Experience from "./components/Experience";
import Projects from "./components/Projects";
import Skills from "./components/Skills";

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
    
    if (oppositeElem) {
      oppositeElem.removeAttribute("filter", "brightness(40%)");
    }
    if (pickedElem) {
      pickedElem.setAttribute("filter", "brightness(40%)");
    }
  };

  componentDidMount() {
    this.loadSharedData();
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
      <div>
        <Header sharedData={this.state.sharedData.basic_info} />
        <div className="col-md-12 mx-auto text-center language">
          <div
            onClick={() =>
              this.applyPickedLanguage(
                window.$primaryLanguage,
                window.$secondaryLanguageIconId
              )
            }
            style={{ display: "inline" }}
          >
            <span
              className="iconify language-icon mr-5"
              data-icon="twemoji-flag-for-flag-united-kingdom"
              data-inline="false"
              id={window.$primaryLanguageIconId}
            ></span>
          </div>
          <div
            onClick={() =>
              this.applyPickedLanguage(
                window.$secondaryLanguage,
                window.$primaryLanguageIconId
              )
            }
            style={{ display: "inline" }}
          >
            <span
              className="iconify language-icon"
              data-icon="twemoji-flag-for-flag-france"
              data-inline="false"
              id={window.$secondaryLanguageIconId}
            ></span>
          </div>
        </div>
        <About
          resumeBasicInfo={this.state.resumeData.basic_info}
          sharedBasicInfo={this.state.sharedData.basic_info}
        />
        <Projects
          resumeProjects={this.state.resumeData.projects}
          resumeBasicInfo={this.state.resumeData.basic_info}
        />
        <Skills
          sharedSkills={this.state.sharedData.skills}
          resumeBasicInfo={this.state.resumeData.basic_info}
        />
        <Experience
          resumeExperience={this.state.resumeData.experience}
          resumeBasicInfo={this.state.resumeData.basic_info}
        />
        <Footer 
          sharedBasicInfo={this.state.sharedData.basic_info}
          peepBasterds={peepBasterds}
        />
      </div>
    );
  }
}

export default App;
