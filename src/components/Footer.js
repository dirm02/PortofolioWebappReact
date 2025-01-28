import React, { Component } from "react";

class Footer extends Component {
  render() {
    if (this.props.sharedBasicInfo) {
      var networks = this.props.sharedBasicInfo.social.map(function (network) {
        return (
          <span key={network.name} className="m-4">
            <a href={network.url} target="_blank" rel="noopener noreferrer">
              <i className={network.class}></i>
            </a>
          </span>
        );
      });
    }

    return (
      <footer>
        <div className="container">
          <div className="row">
            <div className="col social-links">
              {networks}
              <div className="footer-view-counter">
                <span role="img" aria-label="eyes">👀</span> {this.props.peepBasterds || 0}
              </div>
            </div>
            <div className="row">
              <div className="col copyright">
                <div className="copyright py-4 text-center">
                  <div className="container">
                    <small>
                      Copyright &copy;{" "}
                      {this.props.sharedBasicInfo
                        ? this.props.sharedBasicInfo.email
                        : "???"}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }
}

export default Footer;
