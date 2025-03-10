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
const BACKEND_URL =  'https://24.156.182.222:8443';
// Cookie helper functions
const setCookie = (name, value, days) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resumeData: {},
      sharedData: {},
      Views: 0
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
    console.log('=== App Initialization Debug ===');
    console.log('Component mounting, checking for view counter...');
    
    this.loadSharedData();
    this.applyPickedLanguage(
      window.$primaryLanguage,
      window.$secondaryLanguageIconId
    );
    
    // Check if this is a new visit
    const visitCookie = getCookie('lastVisit');
    const now = new Date().getTime();
    console.log('Current cookie status:', { visitCookie, now });
    
    if (!visitCookie || (now - parseInt(visitCookie)) > 24 * 60 * 60 * 1000) {
      console.log('No cookie or expired, incrementing view count...');
      this.incrementViewCount();
      setCookie('lastVisit', now, 1);
    } else {
      console.log('Recent visit detected, fetching current count...');
      this.fetchCurrentCount();
    }
  }

  componentWillUnmount() {
    if (this.viewCountInterval) {
      clearInterval(this.viewCountInterval);
    }
  }

  incrementViewCount = async () => {
    try {
      console.log('=== View Counter Debug Info ===');
      console.log('Frontend URL:', window.location.href);
      console.log('Backend URL:', BACKEND_URL);
      console.log('Attempting to increment view count...');
      
      const response = await fetch(`${BACKEND_URL}/api/views`, {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Response data:', data);
      console.log('=== End Debug Info ===');
      
      this.setState({ peepBasterds: data.views });
    } catch (error) {
      console.error('=== View Counter Error ===');
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
      console.error('=== End Error ===');
    }
  };

  fetchCurrentCount = async () => {
    const maxRetries = 5; // Increased retries for warm-up period
    let retryCount = 0;
    
    const tryFetch = async () => {
      try {
        console.log(`=== Fetching View Count (Attempt ${retryCount + 1}/${maxRetries}) ===`);
        console.log('Requesting current count from:', `${BACKEND_URL}/api/views`);
        
        const response = await fetch(`${BACKEND_URL}/api/views`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received view count data:', data);
        
        if (data.status === 'warming_up') {
          console.log('Server is warming up, will retry...');
          if (retryCount < maxRetries - 1) {
            retryCount++;
            console.log(`Waiting 10 seconds for server warm-up... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            return tryFetch();
          }
        }
        
        if (data.views === 0) {
          console.warn('Warning: Received zero views from backend!');
          console.log('Backend URL:', BACKEND_URL);
          console.log('Current state:', this.state);
          
          // Try to fetch stats for more information
          const statsResponse = await fetch(`${BACKEND_URL}/api/stats`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            console.log('Stats data:', statsData);
          }
        }
        
        this.setState({ peepBasterds: data.views });
        console.log('View count updated in state:', data.views);
      } catch (error) {
        console.error(`=== View Counter Error (Attempt ${retryCount + 1}) ===`);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
        console.error('Backend URL:', BACKEND_URL);
        console.error('Current state:', this.state);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          const delay = error.message.includes('Failed to fetch') ? 10000 : 2000;
          console.log(`Retrying in ${delay/1000} seconds... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return tryFetch();
        }
      }
    };
    
    await tryFetch();
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
              data-icon="twemoji-flag-for-flag-canada"
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
