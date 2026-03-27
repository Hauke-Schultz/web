FROM php:8.2-apache

# PHP extensions für MySQL
RUN docker-php-ext-install pdo pdo_mysql mysqli

# mod_rewrite für saubere URLs aktivieren
RUN a2enmod rewrite headers

# Arbeitsverzeichnis
WORKDIR /var/www/html
