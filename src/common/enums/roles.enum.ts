export enum HierarchyLevel {
  OWNER = 'OWNER',                   
  ADMIN = 'ADMIN',                   
  MANAGER = 'MANAGER',               
  DEPARTMENT_LEAD = 'DEPARTMENT_LEAD', 
  TEAM_LEAD = 'TEAM_LEAD',           
  SENIOR = 'SENIOR',                 
  MID_LEVEL = 'MID_LEVEL',           
  JUNIOR = 'JUNIOR',                 
  GUEST = 'GUEST',                   
}

export enum Profession {
  // Yazılım
  FRONTEND_DEV = 'FRONTEND_DEV',
  BACKEND_DEV = 'BACKEND_DEV',
  FULLSTACK_DEV = 'FULLSTACK_DEV',
  MOBILE_DEV = 'MOBILE_DEV',
  DEVOPS_ENGINEER = 'DEVOPS_ENGINEER',
  
  // Tasarım
  UI_UX_DESIGNER = 'UI_UX_DESIGNER',
  GRAPHIC_DESIGNER = 'GRAPHIC_DESIGNER',

  // Kalite & Ürün
  QA_AUTOMATION = 'QA_AUTOMATION',
  PRODUCT_OWNER = 'PRODUCT_OWNER',

  // Pazarlama & Genel
  MARKETING_SPECIALIST = 'MARKETING_SPECIALIST',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  CLIENT = 'CLIENT', 
}