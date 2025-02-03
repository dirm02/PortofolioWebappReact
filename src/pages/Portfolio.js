import React from "react";
import Header from "../components/Header";
import About from "../components/About";
import Projects from "../components/Projects";
import Skills from "../components/Skills";
import Experience from "../components/Experience";
import Footer from "../components/Footer";

const Portfolio = (props) => {
  return (
    <>
      <Header 
        sharedData={props.sharedBasicInfo}
        applyPickedLanguage={props.applyPickedLanguage}
      />
      <About
        sharedBasicInfo={props.sharedBasicInfo}
        resumeBasicInfo={props.resumeBasicInfo}
      />
      <Projects
        resumeProjects={props.resumeProjects}
        resumeBasicInfo={props.resumeBasicInfo}
      />
      <Skills
        sharedSkills={props.sharedSkills}
        resumeBasicInfo={props.resumeBasicInfo}
      />
      <Experience
        resumeExperience={props.resumeExperience}
        resumeBasicInfo={props.resumeBasicInfo}
      />
      <Footer
        sharedBasicInfo={props.sharedBasicInfo}
        peepBasterds={props.peepBasterds}
      />
    </>
  );
};

export default Portfolio; 