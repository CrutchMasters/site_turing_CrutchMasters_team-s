// src/context/translations.ts

export const translations = {
    en: {
        nav: {
            signIn: "Sign In",
            signUp: "Sign Up",
            backHome: "Back to main",
        },
        hero: {
            ecosystem: "Ecosystem",
            ecosystemDesc: "A complete environment for",
            organizers: "Organizers",
            participants: "Participants",
            functionality: "Functionality",
            funcDesc: "Managing tournaments, automatic statistics, and team building in one place.",
            getStarted: "Get Started",
            learnMore: "Learn More",
        },
        auth: {
            loginTitle: "Code Future",
            registerTitle: "Code Future",
            login: "gmail / login ...",
            password: "password ...",
            confirmPassword: "conf. pass...",
            username: "username ...",
            email: "gmail ...",
            loginBtn: "Sign In",
            registerBtn: "Registered",
            noAccount: "Don't have an account?",
            haveAccount: "Already have an account?",
            toSignUp: "sign up",
            toSignIn: "sign in",
            privacy: "Privacy Policy",
        },
        settings: {
            title: "System Settings",
            lang: "Language",
            status: "Backend",
        },
        infoSections: [
            { title: "Tournament Platform", text: "Create and manage IT competitions with ease." },
            { title: "Real-time Stats", text: "Track progress and results instantly." },
            { title: "Team Management", text: "Find teammates and build your dream team." },
            { title: "Safe & Secure", text: "Your data is protected by modern encryption." },
            { title: "Community", text: "Connect with developers from all over the world." },
        ]
    },
    ru: {
        nav: {
            signIn: "Войти",
            signUp: "Регистрация",
            backHome: "На главную",
        },
        hero: {
            ecosystem: "Экосистема",
            ecosystemDesc: "Полная среда для",
            organizers: "Организаторов",
            participants: "Участников",
            functionality: "Функционал",
            funcDesc: "Управление турнирами, автоматическая статистика и создание команд в одном месте.",
            getStarted: "Начать",
            learnMore: "Узнать больше",
        },
        auth: {
            loginTitle: "Code Future",
            registerTitle: "Регистрация",
            login: "почта / логин ...",
            password: "пароль ...",
            confirmPassword: "подтвердите ...",
            username: "имя пользователя ...",
            email: "почта ...",
            loginBtn: "Войти",
            registerBtn: "Создать аккаунт",
            noAccount: "Нет аккаунта?",
            haveAccount: "Уже есть аккаунт?",
            toSignUp: "регистрация",
            toSignIn: "войти",
            privacy: "Политика конфиденциальности",
        },
        settings: {
            title: "Настройки системы",
            lang: "Язык",
            status: "Бэкенд",
        },
        infoSections: [
            { title: "Платформа турниров", text: "Создавайте и управляйте ИТ-соревнованиями с легкостью." },
            { title: "Статистика в реальном времени", text: "Мгновенно отслеживайте прогресс и результаты." },
            { title: "Управление командами", text: "Находите единомышленников и создавайте команду мечты." },
            { title: "Безопасность", text: "Ваши данные защищены современным шифрованием." },
            { title: "Сообщество", text: "Общайтесь с разработчиками со всего мира." },
        ]
    },
    ua: {
        nav: {
            signIn: "Увійти",
            signUp: "Реєстрація",
            backHome: "На головну",
        },
        hero: {
            ecosystem: "Екосистема",
            ecosystemDesc: "Повне середовище для",
            organizers: "Організаторів",
            participants: "Учасників",
            functionality: "Функціонал",
            funcDesc: "Управління турнірами, автоматична статистика та створення команд в одному місці.",
            getStarted: "Почати",
            learnMore: "Дізнатися більше",
        },
        auth: {
            loginTitle: "Code Future",
            registerTitle: "Реєстрація",
            login: "пошта / логін ...",
            password: "пароль ...",
            confirmPassword: "підтвердіть ...",
            username: "ім'я користувача ...",
            email: "пошта ...",
            loginBtn: "Увійти",
            registerBtn: "Створити акаунт",
            noAccount: "Немає акаунту?",
            haveAccount: "Вже є акаунт?",
            toSignUp: "реєстрація",
            toSignIn: "увійти",
            privacy: "Політика конфіденційності",
        },
        settings: {
            title: "Налаштування системи",
            lang: "Мова",
            status: "Бекенд",
        },
        infoSections: [
            { title: "Платформа турнірів", text: "Створюйте та керуйте ІТ-змаганнями з легкістю." },
            { title: "Статистика в реальному часі", text: "Миттєво відстежуйте прогрес та результати." },
            { title: "Управління командами", text: "Знаходьте однодумців та створюйте команду мрії." },
            { title: "Безпека", text: "Ваші дані захищені сучасним шифруванням." },
            { title: "Спільнота", text: "Спілкуйтеся з розробниками з усього світу." },
        ]
    }
};

export type Locale = keyof typeof translations;
