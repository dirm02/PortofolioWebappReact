import React, { Component } from "react";
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from "react-vertical-timeline-component";
import "react-vertical-timeline-component/style.min.css";
import Badge from "react-bootstrap/Badge";

class Experience extends Component {
  getExperienceIcon = (company) => {
    // Map companies to their respective icons
    const iconMap = {
      "Microsoft": "fab fa-microsoft",
      "Apple": "fab fa-apple",
      "Amazon": "fab fa-amazon",
      "Google": "fab fa-google",
      "Facebook": "fab fa-facebook",
      "Twitter": "fab fa-twitter",
      "LinkedIn": "fab fa-linkedin",
      "GitHub": "fab fa-github",
      "Outlier": "fas fa-code",
      "Sobeys & Soroc - Canadian Tire Gas Bar": "fas fa-gas-pump",
      "Shared Services Canada": "fas fa-headset",
      "Fujitsu": "fas fa-chart-line",
      // Add more mappings as needed
      // Default icons for different roles
      "Developer": "fas fa-code",
      "Engineer": "fas fa-cogs",
      "Designer": "fas fa-paint-brush",
      "Manager": "fas fa-tasks",
      "Analyst": "fas fa-chart-line",
      "Support": "fas fa-headset",
      "Admin": "fas fa-user-shield",
      "Consultant": "fas fa-handshake"
    };

    // Try to find a matching company icon
    for (let key in iconMap) {
      if (company.toLowerCase().includes(key.toLowerCase())) {
        return iconMap[key];
      }
    }

    // Default to a code icon if no match found
    return "fas fa-laptop-code";
  };

  render() {
    if (this.props.resumeExperience && this.props.resumeBasicInfo) {
      var sectionName = this.props.resumeBasicInfo.section_name.experience;
      var work = this.props.resumeExperience.map((work, i) => {
        const technologies = work.technologies;
        const mainTechnologies = work.mainTech;

        var mainTech = mainTechnologies.map((technology, i) => {
          return (
            <Badge pill className="main-badge mr-2 mb-2" key={i}>
              {technology}
            </Badge>
          );
        });
        var tech = technologies.map((technology, i) => {
          return (
            <Badge pill className="experience-badge mr-2 mb-2" key={i}>
              {technology}
            </Badge>
          );
        });

        // Get appropriate icon based on company name
        const iconClass = this.getExperienceIcon(work.company);

        return (
          <VerticalTimelineElement
            className="vertical-timeline-element--work"
            date={work.years}
            iconStyle={{
              background: "#AE944F",
              color: "#fff",
              textAlign: "center",
            }}
            icon={<i className={`${iconClass} experience-icon`}></i>}
            key={i}
          >
            <div style={{ textAlign: "left", marginBottom: "4px" }}>
              {mainTech}
            </div>

            <h3
              className="vertical-timeline-element-title"
              style={{ textAlign: "left" }}
            >
              {work.title}
            </h3>
            <h4
              className="vertical-timeline-element-subtitle"
              style={{ textAlign: "left" }}
            >
              {work.company}
            </h4>
            <div style={{ textAlign: "left", marginTop: "15px" }}>{tech}</div>
          </VerticalTimelineElement>
        );
      });
    }

    return (
      <section id="resume" className="pb-5">
        <div className="col-md-12 mx-auto">
          <div className="col-md-12">
            <h1 className="section-title" style={{ color: "black" }}>
              <span className="text-black" style={{ textAlign: "center" }}>
                {sectionName}
              </span>
            </h1>
          </div>
        </div>
        <div className="col-md-8 mx-auto">
          <VerticalTimeline>
            {work}
            <VerticalTimelineElement
              iconStyle={{
                background: "#AE944F",
                color: "#fff",
                textAlign: "center",
              }}
              icon={
                <i className="fas fa-hourglass-start mx-auto experience-icon"></i>
              }
            />
          </VerticalTimeline>
        </div>
      </section>
    );
  }
}

export default Experience;
