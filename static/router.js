// static/router.js — core routing for SPA navigation
export const Router = {
  sections: Array.from(document.querySelectorAll("main > section")),
  showOnly(id) {
    this.sections.forEach(sec => {
      sec.hidden = sec.id !== id;
      sec.tabIndex = -1;
    });
    localStorage.setItem("last_page", id);
    const target = document.getElementById(id);
    if (target) target.focus();
  }
};

export const showOnly = Router.showOnly.bind(Router);
