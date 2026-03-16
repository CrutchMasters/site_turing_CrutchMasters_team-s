// src/lib/translations.ts

export const translations = {
    en: {
        nav: { signIn: "Sign In", signUp: "Sign Up", back: "Back to main", backHome: "Back to home" },
        hero: {
            ecosystem: "Ecosystem",
            ecosystemDesc: "A comprehensive environment for IT tournaments connecting",
            organizers: "organizers",
            participants: "participants",
            functionality: "Functionality",
            funcDesc: "Our core engine handles dynamic rounds and expert review with ease.",
            getStarted: "Get Started",
            learnMore: "Learn More"
        },
        auth: {
            loginTitle: "Code Future",
            registerTitle: "Code Future",
            username: "username ...",
            login: "login / email ...",
            email: "gmail ...",
            password: "password ...",
            confirmPassword: "conf. pass...",
            privacy: "Privacy Policy",
            registerBtn: "Registered",
            loginBtn: "Sign In",
            haveAccount: "Already have an account?",
            noAccount: "Don't have an account?",
            toSignIn: "sign in",
            toSignUp: "sign up"
        },
        settings: { title: "Settings", lang: "Language", status: "Backend Status" },
        infoSections: [
            { title: "🏆 Tournament Organization", text: "Create tournaments of any scale with full administrative control." },
            { title: "👥 Team Interface", text: "Simplified entry process and automated validation." },
            { title: "💻 Assignments", text: "Structured workflow with informative rounds." },
            { title: "⚖️ Evaluation", text: "Objectivity with criteria-based scoring." },
            { title: "🚀 Advanced", text: "Smart notifications and data export." }
        ]
    },
    ru: {
        nav: { signIn: "Войти", signUp: "Регистрация", back: "На главную", backHome: "На главную" },
        hero: {
            ecosystem: "Экосистема",
            ecosystemDesc: "Комплексная среда для IT-турниров, объединяющая",
            organizers: "организаторов",
            participants: "участников",
            functionality: "Функционал",
            funcDesc: "Наш движок с легкостью управляет раундами и оценкой.",
            getStarted: "Начать",
            learnMore: "Подробнее"
        },
        auth: {
            loginTitle: "Code Future",
            registerTitle: "Регистрация",
            username: "имя пользователя ...",
            login: "логин / почта ...",
            email: "почта gmail ...",
            password: "пароль ...",
            confirmPassword: "подтверждение...",
            privacy: "Политика конфиденциальности",
            registerBtn: "Создать аккаунт",
            loginBtn: "Войти",
            haveAccount: "Уже есть аккаунт?",
            noAccount: "Нет аккаунта?",
            toSignIn: "войти",
            toSignUp: "регистрация"
        },
        settings: { title: "Настройки", lang: "Язык", status: "Статус Бэкенда" },
        infoSections: [
            { title: "🏆 Организация турниров", text: "Создавайте турниры любого масштаба с полным контролем." },
            { title: "👥 Командный интерфейс", text: "Упрощенный процесс подачи заявок и валидация." },
            { title: "💻 Задания и решения", text: "Структурированный рабочий процесс и трекинг задач." },
            { title: "⚖️ Система оценивания", text: "Объективность и динамические таблицы лидеров." },
            { title: "🚀 Продвинутые функции", text: "Умные уведомления и экспорт данных." }
        ]
    },
    ua: {
        nav: { signIn: "Увійти", signUp: "Реєстрація", back: "На головну", backHome: "На головну" },
        hero: {
            ecosystem: "Екосистема",
            ecosystemDesc: "Комплексне середовище для IT-турнірів, що об'єднує",
            organizers: "організаторів",
            participants: "учасників",
            functionality: "Функціонал",
            funcDesc: "Наш движок з легкістю керує раундами та експертною оцінкою.",
            getStarted: "Почати",
            learnMore: "Докладніше"
        },
        auth: {
            loginTitle: "Code Future",
            registerTitle: "Реєстрація",
            username: "ім'я користувача ...",
            login: "логін / пошта ...",
            email: "пошта gmail ...",
            password: "пароль ...",
            confirmPassword: "підтвердження...",
            privacy: "Політика конфіденційності",
            registerBtn: "Створити акаунт",
            loginBtn: "Увійти",
            haveAccount: "Вже є акаунт?",
            noAccount: "Немає акаунту?",
            toSignIn: "увійти",
            toSignUp: "реєстрація"
        },
        settings: { title: "Налаштування", lang: "Мова", status: "Статус Бекенду" },
        infoSections: [
            { title: "🏆 Організація турнірів", text: "Створюйте турніри будь-якого масштабу з повним контролем." },
            { title: "👥 Командний інтерфейс", text: "Спрощений процес подачі заявок та валідація." },
            { title: "💻 Завдання та рішення", text: "Структурований робочий процес та трекінг завдань." },
            { title: "⚖️ Система оцінювання", text: "Об'єктивність та динамічні таблиці лідерів." },
            { title: "🚀 Просунуті функції", text: "Розумні сповіщення та експорт даних." }
        ]
    }
};

export type Locale = keyof typeof translations;
