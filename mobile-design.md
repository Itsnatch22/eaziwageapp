Mobile design UI scope 1 presented by @Itsnatch22 and @TheeKJ

# Welcome page
1. Logo
2. Present slides to showcase what EaziWage is about. 4-max
3. Login page and register page
4. redirect to either employer or employee

## Welcome Page Flowchart
```mermaid
flowchart LR
  Start([Start])
  Logo["Logo"]
  Slides["Intro Carousel\n(<=4 slides)"]
  CTA{Have an account?}
  Login[/Login/]
  Register[/Register/]
  RoleSel{Select role}
  Employer["Employer\nDashboard"]
  Employee["Employee\nDashboard"]

  Start --> Logo --> Slides --> CTA
  CTA -- Yes --> Login --> RoleSel
  CTA -- No --> Register --> RoleSel
  RoleSel -- Employer --> Employer
  RoleSel -- Employee --> Employee
  Slides -->|Skip| RoleSel
```
