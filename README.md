# ServantJS
**ServantJS** - это открытая клиент-серверная платформа для доставки пакетов заданий до клиентов. Клиенты могут объединяться в группы, что позволяет обеспечивать целостность данных среди участников группы. Платформа является модульной, что позволяет расширять ее базовый функционал.

## Особенности

* *Кроссплатформенность*: ServantJS основ на Node.js, поэтому может быть запущен практически на любой операционной системе.
* *Централизованность*: ServantJS позволяет отправлять задания своим агентам как для автоматизации бизнес процессов, так и для обеспечения единой информацией нескольких серверов (например поддержка одинаковых настроек веб-сервера nginx для отказоустойчивости).
* *Модульность*: "Из коробки" доступна только обработка новых подключений и мониторинг базы данных на новые задания. С помощью модулей и middleware можно расширять функционал платформы до нужного.
* *API*: В наличие имеется REST API сервер для интеграции с другими приложениями и сервисами.
* *Панель управления*: Для удобного администрирование пользователю предлагается Web интерфейс для управления платформой и 
всеми ее модулями.

## Почему не Puppet или Chef?

Такие программные продукты как Puppet и Chef предлагают подобный функционал для централизованного развертывания чего-либо. Но, как правильно, она сосредоточены на развертывание серверной\облачной инфраструктуры, а также приложений на серверах. Минусом является то, что они не рассчитаны на хранения конфигурационных файлов, например, как сущностей в виде "клиента". Модули ServantJS могут обладать любым по сложности функционалом, начиная от конфигурирования приложения и заканчивая ~~автоматическим развертывание виртуальных машим в облаке~~ вашим воображением.
 
ServantJS прежде всего рассчитан для программистов, которые могут дописать ServantJS под себя с помощью своих модулей. Puppet и Chef изначально требуют знаний скриптовых языков и своих встроенных для начальной работы. ServantJS для конечных пользователей не требует навыков программирование. Панель управления дает уже необходимый набор инструментов для работы.

## Как это работает

ServantJS состоит из следующих компонентов: 

* *сервер* - принимает новые подключения от агентов, распределяет поступающие задания по агентам.
* *агент* - принимает задания от сервера, обрабатывает их и отправляет результат обратно на сервер.
* *панель* управления - предоставляет web интерфейс для работы в системе, который предоставляет обширную информацию по работе системы, включая отчеты по каждому отправленному заданию и всех данных, хранящихся в модулях.
* *API сервер* - RESP API сервер для интеграции с другими сервисами.

С помощью панели управления или API сервера в базу данных поступают задания, которые должны быть обработаны модулем на сервере, далее должен быть сформирован пакет, который должен быть отправлен указанным агентам в задание.  

## Что уже есть

На данный момент уже есть общая концепция платформы. Также написаны несколько полезных модулей, которыми можно воспользоваться уже сейчас. Есть 2 модуля, которыми вы можете воспользоваться:
* *nginx* - модуль по управлению конфигурационными файлами. Также есть возможность создать шаблоны, на основе которых можно создавать полноценные конфигурационные файлы указывая лишь изменяющиеся параметры при создание файла.
* *haproxy* - модуль по управлению конфигурационными файлами. Каждый конфигурационный файл представляет из себя набор блоков. Блоками можно управлять по отдельности: включая или исключая их из файла. Также для блоков можно задавать произвольные параметры, которые выступают в роли комментариев.  

_Также есть модуль по мониторингу за серверами, но он находится еще на стадии alpha._

## Контакты

Если у вас есть вопрос или предложения, то пишите на почту servantjs.company@gmail.com или оставляйте свои пожелания через "Issue" в github'е.

## Дополнительно

В разделе wiki вы сможете найти дополнительную информацию по установке, разработке модулей и т.д.